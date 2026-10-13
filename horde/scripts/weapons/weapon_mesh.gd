class_name WeaponMesh
## Procedural melee weapon meshes (lofted cross-sections), so blades read as
## forged steel instead of boxes. Model space: handle at the origin, the
## weapon extends along -Z, the edge plane is X.


## Loft a closed cross-section along a path. `rings` is an array of
## [center: Vector3, half_width: float, half_thickness: float]; `profile`
## is a closed polygon in unit (x = width, y = thickness) space. Flat-shaded
## (every triangle has its own vertices) so the bevels catch the light.
static func loft(rings: Array, profile: PackedVector2Array, cap_start := true, cap_end := true) -> ArrayMesh:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var pts := []
	for r in rings:
		var c: Vector3 = r[0]
		var ring := []
		for p in profile:
			ring.append(c + Vector3(p.x * r[1], p.y * r[2], 0.0))
		pts.append(ring)
	var n := profile.size()
	for i in pts.size() - 1:
		for k in n:
			var a: Vector3 = pts[i][k]
			var b: Vector3 = pts[i][(k + 1) % n]
			var c: Vector3 = pts[i + 1][k]
			var d: Vector3 = pts[i + 1][(k + 1) % n]
			_tri(st, a, c, b)
			_tri(st, b, c, d)
	if cap_start:
		_cap(st, pts[0], true)
	if cap_end:
		_cap(st, pts[pts.size() - 1], false)
	st.generate_normals()
	return st.commit()


static func _tri(st: SurfaceTool, a: Vector3, b: Vector3, c: Vector3) -> void:
	if (b - a).cross(c - a).length_squared() < 1e-12:
		return
	st.add_vertex(a)
	st.add_vertex(b)
	st.add_vertex(c)


static func _cap(st: SurfaceTool, ring: Array, flip: bool) -> void:
	var c := Vector3.ZERO
	for p in ring:
		c += p
	c /= ring.size()
	for k in ring.size():
		var a: Vector3 = ring[k]
		var b: Vector3 = ring[(k + 1) % ring.size()]
		if flip:
			_tri(st, c, a, b)
		else:
			_tri(st, c, b, a)


## Tube along a path of points (round-ish, `sides` facets); radii per point.
static func tube(path: Array, radii: Array, sides := 8) -> ArrayMesh:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var rings := []
	for i in path.size():
		var p: Vector3 = path[i]
		var t: Vector3 = ((path[mini(i + 1, path.size() - 1)] as Vector3) - (path[maxi(i - 1, 0)] as Vector3)).normalized()
		var u := Vector3.UP if absf(t.dot(Vector3.UP)) < 0.9 else Vector3.RIGHT
		var x := t.cross(u).normalized()
		var y := x.cross(t)
		var ring := []
		for k in sides:
			var ang := TAU * k / sides
			ring.append(p + (x * cos(ang) + y * sin(ang)) * float(radii[i]))
		rings.append(ring)
	for i in rings.size() - 1:
		for k in sides:
			var a: Vector3 = rings[i][k]
			var b: Vector3 = rings[i][(k + 1) % sides]
			var c: Vector3 = rings[i + 1][k]
			var d: Vector3 = rings[i + 1][(k + 1) % sides]
			_tri(st, a, b, c)
			_tri(st, b, d, c)
	_cap(st, rings[0], false)
	_cap(st, rings[rings.size() - 1], true)
	st.generate_normals()
	return st.commit()


# Blade cross-section: flat diamond with a shallow fuller groove each side.
static func blade_profile() -> PackedVector2Array:
	return PackedVector2Array([
		Vector2(1.0, 0.0), Vector2(0.55, 0.75), Vector2(0.18, 1.0), Vector2(0.0, 0.62), Vector2(-0.18, 1.0),
		Vector2(-0.55, 0.75), Vector2(-1.0, 0.0), Vector2(-0.55, -0.75), Vector2(-0.18, -1.0), Vector2(0.0, -0.62),
		Vector2(0.18, -1.0), Vector2(0.55, -0.75)])


static func box_profile() -> PackedVector2Array:
	return PackedVector2Array([Vector2(1, 0.7), Vector2(0.7, 1), Vector2(-0.7, 1), Vector2(-1, 0.7),
		Vector2(-1, -0.7), Vector2(-0.7, -1), Vector2(0.7, -1), Vector2(1, -0.7)])


## Greatsword (Relic-Blade-like two-hander): long grip with wrap rings,
## curved crossguard, ricasso, broad tapering blade to a point.
static func greatsword(root: Node3D, steel: Material, brass: Material, leather: Material) -> MeshInstance3D:
	# Blade: from the ricasso (z=-0.37) to the point (z=-1.5).
	var rings := []
	var z0 := -0.37
	var length := 1.13
	for i in 15:
		var k := float(i) / 14.0
		var z := z0 - k * length
		var w: float
		if k < 0.05:
			w = 0.036         # ricasso, narrow and thick
		elif k < 0.88:
			w = lerp(0.054, 0.04, (k - 0.05) / 0.83)
		else:
			w = lerp(0.04, 0.0015, (k - 0.88) / 0.12)
		var t: float = lerp(0.009, 0.0055, k) if k < 0.88 else lerp(0.0055, 0.001, (k - 0.88) / 0.12)
		rings.append([Vector3(0, 0, z), w, t])
	var mi := MeshInstance3D.new()
	mi.mesh = loft(rings, blade_profile())
	mi.name = "Blade"
	mi.material_override = steel
	root.add_child(mi)
	# Crossguard: quillons sweeping slightly toward the blade.
	var guard := []
	var gr := []
	for i in 9:
		var k := float(i) / 8.0 * 2.0 - 1.0
		guard.append(Vector3(k * 0.19, 0.0, -0.35 - 0.05 * k * k))
		gr.append(0.016 - 0.006 * absf(k))
	Mats.add_mesh(root, tube(guard, gr, 6), brass)
	Mats.add_mesh(root, Mats.box(Vector3(0.09, 0.05, 0.07)), brass, Vector3(0, 0, -0.36))
	# Grip with leather wrap rings, then a faceted pommel.
	var grip := []
	var grr := []
	for i in 17:
		var k := float(i) / 16.0
		grip.append(Vector3(0, 0, -0.33 + k * 0.33))
		grr.append(0.019 + (0.003 if i % 2 == 0 else 0.0))
	Mats.add_mesh(root, tube(grip, grr, 8), leather)
	var pommel := []
	var pr := []
	for i in 6:
		var k := float(i) / 5.0
		pommel.append(Vector3(0, 0, 0.005 + k * 0.06))
		pr.append(0.035 * sin(k * PI) + 0.012)
	Mats.add_mesh(root, tube(pommel, pr, 8), brass)
	return mi


## Scrap riot shield: a dented, rusted steel slab with a rim, a vision slit
## and rivets, held by a grip at its centre. Faces -Z (away from the hand).
static func riot_shield(root: Node3D) -> void:
	var rust := Mats.color(Color(0.3, 0.22, 0.16), 0.8, 0.5)
	var steel := Mats.color(Color(0.26, 0.27, 0.28), 0.55, 0.75)
	var plate := []
	# Slightly curved plate (bent around the bearer).
	for i in 7:
		var k := float(i) / 6.0 * 2.0 - 1.0
		plate.append([Vector3(k * 0.3, 0, -0.08 + 0.05 * k * k), 0.0, 0.0])
	# Built as boxes along the curve: cheap and reads well at a distance.
	for i in plate.size() - 1:
		var a: Vector3 = plate[i][0]
		var b: Vector3 = plate[i + 1][0]
		var mid := (a + b) * 0.5
		var seg := Mats.add_mesh(root, Mats.box(Vector3(a.distance_to(b) + 0.005, 0.95, 0.025)), rust if i % 3 != 1 else steel, mid)
		seg.rotation.y = -atan2(b.z - a.z, b.x - a.x)
	Mats.add_mesh(root, Mats.box(Vector3(0.64, 0.04, 0.04)), steel, Vector3(0, 0.47, -0.06))
	Mats.add_mesh(root, Mats.box(Vector3(0.64, 0.04, 0.04)), steel, Vector3(0, -0.47, -0.06))
	Mats.add_mesh(root, Mats.box(Vector3(0.2, 0.03, 0.03)), Mats.color(Color(0.02, 0.02, 0.02), 0.9), Vector3(0, 0.3, -0.1))
	for x in [-0.22, 0.0, 0.22]:
		for y in [-0.35, 0.0, 0.35]:
			Mats.add_mesh(root, Mats.sphere(0.012, 6), steel, Vector3(x, y, -0.1 + 0.05 * (x / 0.3) * (x / 0.3)))
	Mats.add_mesh(root, Mats.box(Vector3(0.03, 0.14, 0.05)), steel, Vector3(0, 0, 0.0))


## Wooden haft with a slight swell toward the butt.
static func haft(root: Node3D, length: float, r: float, wood: Material) -> void:
	var path := []
	var rr := []
	for i in 7:
		var k := float(i) / 6.0
		path.append(Vector3(0, 0, 0.04 - k * (length + 0.04)))
		rr.append(r * (1.15 - 0.2 * k))
	Mats.add_mesh(root, tube(path, rr, 7), wood)


## Machete: wooden scales with rivets, a long blade that widens toward a
## clipped tip, edge on +X.
static func machete(root: Node3D, steel: Material, wood: Material) -> MeshInstance3D:
	var grip := []
	var gr := []
	for i in 6:
		var k := float(i) / 5.0
		grip.append(Vector3(0, 0, 0.03 - k * 0.15))
		gr.append(0.018 + 0.004 * sin(k * PI))
	Mats.add_mesh(root, tube(grip, gr, 7), wood)
	var rings := []
	for i in 13:
		var k := float(i) / 12.0
		var z := -0.12 - k * 0.5
		var w: float = lerp(0.022, 0.04, k) if k < 0.85 else lerp(0.04, 0.002, (k - 0.85) / 0.15)
		# The blade bellies toward the edge as it widens.
		rings.append([Vector3(0.012 * k, 0, z), w, 0.003])
	var mi := MeshInstance3D.new()
	mi.mesh = loft(rings, blade_profile())
	mi.name = "Blade"
	mi.material_override = steel
	root.add_child(mi)
	return mi


## Fire axe: long haft, red-painted head with a wide bit (+X) and a pick (-X).
static func fire_axe(root: Node3D, steel: Material, red: Material, wood: Material) -> MeshInstance3D:
	haft(root, 0.95, 0.019, wood)
	var head := []
	for i in 7:
		var k := float(i) / 6.0      # 0 = eye, 1 = edge
		var x := 0.03 + k * 0.17
		head.append([Vector3(x, 0, -0.9), lerp(0.04, 0.1, k * k), lerp(0.026, 0.002, k)])
	var bit := MeshInstance3D.new()
	bit.mesh = _reorient_x(head, box_profile())
	bit.name = "Blade"
	bit.material_override = steel
	root.add_child(bit)
	Mats.add_mesh(root, Mats.box(Vector3(0.08, 0.055, 0.12)), red, Vector3(0.0, 0, -0.9))
	var pick := []
	var pr := []
	for i in 5:
		var k := float(i) / 4.0
		pick.append(Vector3(-0.03 - k * 0.12, 0, -0.9 + 0.02 * k * k))
		pr.append(lerp(0.018, 0.003, k))
	Mats.add_mesh(root, tube(pick, pr, 5), red)
	return bit


## Sledgehammer: long haft, heavy chamfered steel head across the haft.
static func sledgehammer(root: Node3D, steel: Material, wood: Material) -> MeshInstance3D:
	haft(root, 1.02, 0.021, wood)
	var rings := []
	for i in 5:
		var k := float(i) / 4.0
		var face: float = 1.0 if k > 0.1 and k < 0.9 else 0.88
		rings.append([Vector3(-0.15 + k * 0.3, 0, -1.02), 0.07 * face, 0.065 * face])
	var mi := MeshInstance3D.new()
	mi.mesh = _reorient_x(rings, box_profile())
	mi.name = "Blade"
	mi.material_override = steel
	root.add_child(mi)
	return mi


## Loft along +X: rings' half_width spans Z (along the haft), thickness Y.
static func _reorient_x(rings: Array, profile: PackedVector2Array) -> ArrayMesh:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var pts := []
	for r in rings:
		var c: Vector3 = r[0]
		var ring := []
		for p in profile:
			ring.append(c + Vector3(0.0, p.y * r[2], p.x * r[1]))
		pts.append(ring)
	var n := profile.size()
	for i in pts.size() - 1:
		for k in n:
			var a: Vector3 = pts[i][k]
			var b: Vector3 = pts[i][(k + 1) % n]
			var c: Vector3 = pts[i + 1][k]
			var d: Vector3 = pts[i + 1][(k + 1) % n]
			_tri(st, a, b, c)
			_tri(st, b, d, c)
	_cap(st, pts[0], false)
	_cap(st, pts[pts.size() - 1], true)
	st.generate_normals()
	return st.commit()


## Generic sword from a spec: handle along +Z..0, blade toward -Z.
##   grip: handle length          blade: blade length
##   width: [base, mid, near-tip] half-widths    thick: half-thickness at base
##   curve: sideways sag (+X, the edge side) at the blade's middle, metres
##   tip: "point", "clip" (sabre), "flat" (executioner)
##   guard: "cross", "knuckle" (sabre bow), "disc"
##   single_edge: true thickens the back (messer/sabre profile)
static func sword(root: Node3D, spec: Dictionary, steel: Material, fittings: Material, wrap: Material) -> MeshInstance3D:
	var grip: float = spec.get("grip", 0.25)
	var blen: float = spec.get("blade", 0.9)
	var w: Array = spec.get("width", [0.03, 0.028, 0.02])
	var thick: float = spec.get("thick", 0.007)
	var curve: float = spec.get("curve", 0.0)
	var tip: String = spec.get("tip", "point")
	var z0 := -grip - 0.03
	var rings := []
	var n := 18
	for i in n:
		var k := float(i) / (n - 1)
		var z := z0 - k * blen
		var x := curve * sin(k * PI * 0.85) * (1.0 if k < 0.85 else 1.0)
		var hw: float
		if k < 0.5:
			hw = lerp(float(w[0]), float(w[1]), k / 0.5)
		else:
			hw = lerp(float(w[1]), float(w[2]), (k - 0.5) / 0.5)
		var t: float = lerp(thick, thick * 0.55, k)
		match tip:
			"point":
				if k > 0.86:
					hw = lerp(hw, 0.0015, (k - 0.86) / 0.14)
					t = lerp(t, 0.001, (k - 0.86) / 0.14)
			"clip":
				if k > 0.8:
					var q := (k - 0.8) / 0.2
					hw = lerp(hw, 0.0015, q * q)
					x += -hw * q * 0.6          # the back sweeps down to the point
			"flat":
				if k > 0.97:
					hw *= 0.9
		rings.append([Vector3(x, 0, z), hw, t])
	var prof := blade_profile() if not spec.get("single_edge", false) else _single_edge_profile()
	var mi := MeshInstance3D.new()
	mi.mesh = loft(rings, prof)
	mi.name = "Blade"
	mi.material_override = steel
	root.add_child(mi)
	if tip == "flat":
		# Executioner's swords end square with a little dish.
		Mats.add_mesh(root, Mats.box(Vector3(float(w[2]) * 1.8, thick * 1.1, 0.012)), steel, Vector3(rings[n - 1][0].x, 0, z0 - blen))
	# Guard
	match spec.get("guard", "cross"):
		"cross":
			var gw: float = spec.get("guard_w", 0.13)
			var path := []
			var rr := []
			for i in 7:
				var k := float(i) / 6.0 * 2.0 - 1.0
				path.append(Vector3(k * gw, 0, -grip - 0.015 - 0.02 * k * k))
				rr.append(0.011 - 0.004 * absf(k))
			Mats.add_mesh(root, tube(path, rr, 6), fittings)
		"knuckle":
			# A bow from the guard round the knuckles to the pommel.
			var path := []
			var rr := []
			for i in 9:
				var k := float(i) / 8.0
				path.append(Vector3(-0.045 * sin(k * PI) - 0.012, 0, -grip - 0.02 + k * (grip + 0.02)))
				rr.append(0.006)
			Mats.add_mesh(root, tube(path, rr, 5), fittings)
			Mats.add_mesh(root, Mats.box(Vector3(0.07, 0.016, 0.02)), fittings, Vector3(-0.01, 0, -grip - 0.02))
		"disc":
			var d := Mats.add_mesh(root, Mats.cylinder(0.04, 0.01, 12), fittings, Vector3(0, 0, -grip - 0.015))
			d.rotation.x = PI / 2
	if spec.get("nagel", false):
		# Messer: a little nail sticking out of the guard on the flat.
		Mats.add_mesh(root, Mats.box(Vector3(0.01, 0.035, 0.01)), fittings, Vector3(0.015, 0.018, -grip - 0.02))
	# Grip and pommel
	var gpath := []
	var gr := []
	var segs := maxi(4, int(grip / 0.025))
	for i in segs + 1:
		var k := float(i) / segs
		gpath.append(Vector3(0, 0, -grip + k * grip))
		gr.append(0.016 + (0.0025 if i % 2 == 0 else 0.0) + 0.002 * sin(k * PI))
	Mats.add_mesh(root, tube(gpath, gr, 8), wrap)
	var pom := []
	var pr := []
	var ps: float = spec.get("pommel", 0.028)
	for i in 6:
		var k := float(i) / 5.0
		pom.append(Vector3(0, 0, 0.004 + k * ps * 1.6))
		pr.append(ps * sin(k * PI) + 0.008)
	Mats.add_mesh(root, tube(pom, pr, 8), fittings)
	return mi


static func _single_edge_profile() -> PackedVector2Array:
	# Edge at +X, a thick flat spine at -X.
	return PackedVector2Array([Vector2(1.0, 0.0), Vector2(0.4, 0.75), Vector2(-0.6, 1.0), Vector2(-1.0, 0.9),
		Vector2(-1.0, -0.9), Vector2(-0.6, -1.0), Vector2(0.4, -0.75)])
