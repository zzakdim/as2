class_name CityDressing
extends Node3D
## Dresses the grid city with Quaternius' Downtown City MegaKit (CC0).
##
## Every building cell edge that faces the street gets a stacked facade: a
## shopfront/entrance ground floor, window floors above and a cornice at the
## roofline. Convex corners get columns, the pavement gets a sidewalk strip,
## and AC units, bollards and manholes are scattered around. Everything is
## drawn through one MultiMesh per module, so a whole map is a few dozen
## draw calls. Modules are 2 m wide and 3 m per floor, matching the grid.

const DIR := "res://assets/quaternius/city/"
const FLOOR_H := 3.0
const STYLES := [
	{"ground": ["Metal_FirstFloor_Window", "Metal_FirstFloor_Window", "Metal_FirstFloor_Wall"],
		"upper": ["Brick_Window_Square_Single", "Brick_Window_Square_Single", "Brick_Plain_3"], "cornice": "Cornice_Brick_Center"},
	{"ground": ["Trim_FirstFloor_Window_001", "Trim_FirstFloor_Window_001", "Trim_FirstFloor_Wall"],
		"upper": ["Trim_Window", "Trim_Window", "Trim_Plain_3"], "cornice": "Cornice_Trim_Center"},
	{"ground": ["Brick_BottomTrim"],
		"upper": ["Brick_Window_Square_Single", "Brick_Plain_3_noWear", "Brick_TopTrim"], "cornice": "Cornice_Metal_Center"},
	{"ground": ["Metal_FirstFloor_Wall", "Metal_FirstFloor_Window"],
		"upper": ["Trim_Window", "Brick_Window_Square_Single"], "cornice": "Cornice_Metal_Center"},
]

static var _meshes := {}

var lists := {}        # module name -> Array[Transform3D]
var rng := RandomNumberGenerator.new()


static func module_mesh(n: String) -> Mesh:
	if _meshes.has(n):
		return _meshes[n]
	var path := DIR + n + ".gltf"
	var m: Mesh = null
	if ResourceLoader.exists(path):
		var sc: Node = load(path).instantiate()
		var mi: MeshInstance3D = sc.find_children("*", "MeshInstance3D", true, false)[0] if sc.find_children("*", "MeshInstance3D", true, false).size() > 0 else null
		if mi:
			m = mi.mesh
		sc.free()
	_meshes[n] = m
	return m


static func available() -> bool:
	return ResourceLoader.exists(DIR + "Brick_Plain_3.gltf")


func _add(n: String, xf: Transform3D) -> void:
	if not lists.has(n):
		lists[n] = []
	lists[n].append(xf)


## Basis turning a module's +Z face toward `normal` (a grid direction).
static func face(normal: Vector3) -> Basis:
	return Basis(Vector3.UP, atan2(normal.x, normal.z))


func build(lvl) -> void:
	rng.seed = lvl.rng.seed + 99
	var W: int = lvl.W
	var H: int = lvl.H
	var C: float = lvl.CELL
	var dirs := [Vector2i(1, 0), Vector2i(-1, 0), Vector2i(0, 1), Vector2i(0, -1)]
	for z in H:
		for x in W:
			var t: int = lvl.get_t(x, z)
			if t != lvl.T_WALL or lvl.indoor_rect.has_point(Vector2i(x, z)):
				continue
			var h: float = lvl.heights[z * W + x]
			var floors := maxi(1, int((h - 1.0) / FLOOR_H))
			var style: Dictionary = STYLES[(x / 4 * 7 + z / 4 * 13 + lvl.map_index) % STYLES.size()]
			var center: Vector3 = lvl.cell_center(Vector2i(x, z))
			var open := []
			for d in dirs:
				var nt: int = lvl.get_t(x + d.x, z + d.y)
				if lvl.in_bounds(Vector2i(x + d.x, z + d.y)) and not lvl.is_wallish(nt):
					open.append(d)
			for d in open:
				var n := Vector3(d.x, 0, d.y)
				var base := center + n * (C * 0.5)
				var b := face(n)
				var g: Array = style["ground"]
				_add(g[rng.randi() % g.size()], Transform3D(b, base))
				var up: Array = style["upper"]
				for f in range(1, floors):
					var mod: String = up[rng.randi() % up.size()]
					var xf := Transform3D(b, base + Vector3(0, f * FLOOR_H, 0))
					_add(mod, xf)
					if mod.contains("Window") and rng.randf() < 0.12:
						_add("Prop_ACUnit", Transform3D(b, base + Vector3(0, f * FLOOR_H + 0.35, 0) + n * 0.02))
				_add(style["cornice"], Transform3D(b, base + Vector3(0, floors * FLOOR_H, 0)))
				# Sidewalk strip in front of the building.
				_add("_sidewalk", Transform3D(b.scaled(Vector3(2.0, 0.05, 1.4)), base + n * 0.7 + Vector3(0, 0.02, 0)))
				if rng.randf() < 0.06:
					_add("Prop_Bollard", Transform3D(Basis(), base + n * 1.3))
			# Convex corners: a column where two open sides meet.
			for i in open.size():
				for k in range(i + 1, open.size()):
					var a: Vector2i = open[i]
					var c: Vector2i = open[k]
					if a.x * c.x + a.y * c.y != 0:
						continue
					var cn := Vector3(a.x + c.x, 0, a.y + c.y)
					var corner := center + cn * (C * 0.5)
					var cb := face(Vector3(a.x, 0, a.y))
					for f in floors:
						_add("Brick_CornerColumn_Bottom" if f == 0 else "Brick_CornerColumn_Center",
							Transform3D(cb, corner + Vector3(0, f * FLOOR_H, 0) - cn * 0.08))
	# Street details
	for i in 30:
		var c: Vector2i = lvl.random_cell_in_flow(4, lvl.max_flow - 4)
		if c.x >= 0:
			_add("Prop_ManholeCover", Transform3D(Basis(Vector3.UP, rng.randf() * TAU), lvl.cell_center(c) + Vector3(rng.randf_range(-0.5, 0.5), 0.01, rng.randf_range(-0.5, 0.5))))
	_commit()


func _commit() -> void:
	for n in lists:
		var mesh: Mesh
		if n == "_sidewalk":
			mesh = Mats.box(Vector3(1, 1, 1))
		else:
			mesh = module_mesh(n)
		if mesh == null:
			continue
		var mm := MultiMesh.new()
		mm.transform_format = MultiMesh.TRANSFORM_3D
		mm.mesh = mesh
		var arr: Array = lists[n]
		mm.instance_count = arr.size()
		for i in arr.size():
			mm.set_instance_transform(i, arr[i])
		var mmi := MultiMeshInstance3D.new()
		mmi.multimesh = mm
		if n == "_sidewalk":
			mmi.material_override = sidewalk_mat()
			mmi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		add_child(mmi)


static func sidewalk_mat() -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	var tex_path := DIR + "T_MetalConcrete_BaseColor.png"
	if ResourceLoader.exists(tex_path):
		m.albedo_texture = load(tex_path)
	m.albedo_color = Color(0.55, 0.55, 0.53)
	m.roughness = 0.95
	m.uv1_triplanar = true
	m.uv1_world_triplanar = true
	m.uv1_scale = Vector3(0.5, 0.5, 0.5)
	return m
