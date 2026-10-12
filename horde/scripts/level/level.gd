class_name Level
extends Node3D
## Procedurally generated city map on a 2 m grid.
##
## Layout follows the L4D campaign-map formula: start saferoom -> streets,
## alleys and plazas -> a crescendo gate you must open under fire -> end
## saferoom. The final map ends in an open area with a radio finale instead.

const CELL := 2.0
const W := 36
const H := 120

const T_FLOOR := 0
const T_WALL := 1
const T_LOW := 2
const T_SAFE := 3
const T_DOOR := 4
const T_GATE := 5

var grid := PackedByteArray()
var walk := PackedByteArray()     # 1 = infected/survivors can path through
var heights := PackedFloat32Array()
var flow := PackedInt32Array()    # distance from the start door (progress metric)
var max_flow := 1
var rng := RandomNumberGenerator.new()
var map_index := 0
var is_finale := false

var path_center := PackedInt32Array()
var start_room := Rect2i()
var end_room := Rect2i()
var start_door := Vector2i.ZERO
var end_door := Vector2i.ZERO
var start_door_node = null
var end_door_node = null
var gate_row := -1
var gate_runs: Array = []          # [x0, x1] runs of gate cells
var gate_nodes: Array = []
var gate_button_cell := Vector2i(-1, -1)
var radio_cell := Vector2i(-1, -1)
var rescue_rect := Rect2i()
var witch_spots: Array = []
var floor_by_flow: Array = []      # flow value -> Array of cell indices
var spawn_points: Array = []       # survivor start positions
var indoor_rect := Rect2i()
var field_survivors: FlowField
var field_special: FlowField
var field_player: FlowField
var field_end: FlowField
var field_attract: FlowField
var _field_t := 0.0
var _player_field_t := 0.0
var _attractor_key := ""


# ================================================================ grid helpers

func idx(c: Vector2i) -> int:
	return c.y * W + c.x

func in_bounds(c: Vector2i) -> bool:
	return c.x >= 0 and c.y >= 0 and c.x < W and c.y < H

func get_t(x: int, z: int) -> int:
	if x < 0 or z < 0 or x >= W or z >= H:
		return T_WALL
	return grid[z * W + x]

func _setc(x: int, z: int, t: int) -> void:
	if x >= 0 and z >= 0 and x < W and z < H:
		grid[z * W + x] = t

func cell_of(p: Vector3) -> Vector2i:
	return Vector2i(int(floor(p.x / CELL)), int(floor(p.z / CELL)))

func cell_center(c: Vector2i) -> Vector3:
	return Vector3((c.x + 0.5) * CELL, 0.0, (c.y + 0.5) * CELL)

func is_wallish(t: int) -> bool:
	return t == T_WALL or t == T_SAFE

func is_walkable_cell(c: Vector2i) -> bool:
	return in_bounds(c) and walk[idx(c)] == 1

func set_walkable(c: Vector2i, v: bool) -> void:
	if in_bounds(c):
		walk[idx(c)] = 1 if v else 0

func flow_at(p: Vector3) -> int:
	var c := cell_of(p)
	if not in_bounds(c):
		return 0
	var f := flow[idx(c)]
	return f if f < FlowField.UNREACHED else 0

func progress_of(p: Vector3) -> float:
	return clamp(float(flow_at(p)) / float(max_flow), 0.0, 1.0)


## Grid line of sight (walls, closed doors and gates block; cars don't).
func los(a: Vector3, b: Vector3) -> bool:
	var x0 := a.x / CELL
	var z0 := a.z / CELL
	var x1 := b.x / CELL
	var z1 := b.z / CELL
	var cx := int(floor(x0))
	var cz := int(floor(z0))
	var ex := int(floor(x1))
	var ez := int(floor(z1))
	var dx := x1 - x0
	var dz := z1 - z0
	var step_x := 1 if dx > 0 else -1
	var step_z := 1 if dz > 0 else -1
	var t_dx: float = abs(1.0 / dx) if dx != 0 else INF
	var t_dz: float = abs(1.0 / dz) if dz != 0 else INF
	var t_mx: float = ((cx + 1 - x0) if dx > 0 else (x0 - cx)) * t_dx if dx != 0 else INF
	var t_mz: float = ((cz + 1 - z0) if dz > 0 else (z0 - cz)) * t_dz if dz != 0 else INF
	var guard := 0
	while (cx != ex or cz != ez) and guard < 400:
		guard += 1
		if t_mx < t_mz:
			t_mx += t_dx
			cx += step_x
		else:
			t_mz += t_dz
			cz += step_z
		var t := get_t(cx, cz)
		if t == T_WALL or t == T_SAFE or t == T_GATE:
			return false
		if t == T_DOOR and walk[cz * W + cx] == 0:
			return false
	return true


# ================================================================ generation

func generate(seed_v: int, map_idx: int) -> void:
	rng.seed = seed_v
	map_index = map_idx
	is_finale = map_idx == Game.MAPS - 1
	grid.resize(W * H)
	grid.fill(T_WALL)
	heights.resize(W * H)
	path_center.resize(H)
	_carve_streets()
	if map_idx >= 1:
		_carve_warehouse()
	_build_saferooms()
	if not is_finale:
		_place_gate()
	_place_obstacles()
	_finalize_walk()
	_compute_flow()
	_pick_heights()
	_build_geometry()
	_place_lamps()
	_place_items()
	_place_witch_spots()
	field_survivors = FlowField.new(self)
	field_special = FlowField.new(self)
	field_player = FlowField.new(self)
	field_attract = FlowField.new(self)
	field_end = FlowField.new(self)
	var saved := walk.duplicate()
	for i in W * H:
		if grid[i] == T_GATE or grid[i] == T_DOOR:
			walk[i] = 1
	if is_finale:
		field_end.compute([rescue_rect.get_center()])
	else:
		field_end.compute([end_room.get_center()])
	walk = saved


## Melee sandbox: one open arena with some cover, no saferooms or events.
func generate_arena(seed_v: int) -> void:
	rng.seed = seed_v
	map_index = 0
	is_finale = false
	grid.resize(W * H)
	grid.fill(T_WALL)
	heights.resize(W * H)
	path_center.resize(H)
	path_center.fill(W / 2)
	var z1 := 44
	_carve_rect(3, 3, W - 4, z1)
	# pillars and a few cars for footwork
	for i in 10:
		var x := rng.randi_range(6, W - 7)
		var z := rng.randi_range(6, z1 - 3)
		if abs(x - W / 2) + abs(z - 22) > 5:
			_setc(x, z, T_WALL if rng.randf() < 0.5 else T_LOW)
	start_door = Vector2i(W / 2, 22)
	end_room = Rect2i()
	start_room = Rect2i()
	_finalize_walk()
	_compute_flow()
	_pick_heights()
	_build_geometry()
	var z := 8
	while z < z1:
		for side in [-1, 1]:
			var x: int = 4 if side < 0 else W - 5
			var pos := cell_center(Vector2i(x, z)) + Vector3(side * 0.7, 0, 0)
			Props.lamp(self, pos, pos - Vector3(side * 2.0, 0, 0), false)
		z += 12
	var c := cell_center(start_door)
	var ring := ["greatsword", "machete", "pump_shotgun", "assault_rifle", "ammo", "medkit", "pills", "pipe_bomb", "molotov", "bile_jar"]
	for i in ring.size():
		var a := TAU * i / ring.size()
		add_child(Pickup.create(ring[i], c + Vector3(cos(a), 0, sin(a)) * 3.0))
	spawn_points.clear()
	for i in 4:
		spawn_points.append(c + Vector3((i - 1.5) * 1.2, 0.1, 1.0))
	field_survivors = FlowField.new(self)
	field_special = FlowField.new(self)
	field_player = FlowField.new(self)
	field_attract = FlowField.new(self)
	field_end = FlowField.new(self)
	field_end.compute([start_door])


func _carve_rect(x0: int, z0: int, x1: int, z1: int, t := T_FLOOR) -> void:
	for z in range(max(z0, 1), min(z1, H - 2) + 1):
		for x in range(max(x0, 1), min(x1, W - 2) + 1):
			_setc(x, z, t)


func _carve_streets() -> void:
	var cx := float(W / 2)
	var target := cx
	var phase := rng.randf() * 10.0
	var z_min := 7
	var z_max := H - 8
	for z in range(z_min, z_max + 1):
		if z % 7 == 0:
			target = rng.randi_range(9, W - 10)
		cx = move_toward(cx, target, 0.5)
		var hw := 2 + int(round(1.6 * (0.5 + 0.5 * sin(z * 0.19 + phase))))
		path_center[z] = int(round(cx))
		_carve_rect(int(cx) - hw, z, int(cx) + hw, z)
	for z in range(0, z_min):
		path_center[z] = path_center[z_min]
	for z in range(z_max + 1, H):
		path_center[z] = path_center[z_max]
	# Plazas / intersections
	for i in 3:
		var pz := rng.randi_range(14, H - 26)
		var pw := rng.randi_range(5, 7)
		var ph := rng.randi_range(4, 6)
		var pc := path_center[pz + ph / 2]
		_carve_rect(pc - pw, pz, pc + pw, pz + ph)
	# Alleys: side branches that sometimes loop back to the main street.
	for i in 7:
		var az := rng.randi_range(12, H - 18)
		var side := 1 if rng.randf() < 0.5 else -1
		var x := path_center[az]
		var length := rng.randi_range(5, 11)
		var end_x := clampi(x + side * length, 2, W - 3)
		_carve_rect(min(x, end_x), az, max(x, end_x), az + 1)
		if rng.randf() < 0.65:
			var up := rng.randi_range(4, 9)
			_carve_rect(end_x, az, end_x + 1, min(az + up, H - 10))
			var back_z: int = mini(az + up, H - 10)
			var bx := path_center[back_z]
			_carve_rect(min(end_x, bx), back_z, max(end_x, bx), back_z + 1)


func _carve_warehouse() -> void:
	var z0 := int(H * rng.randf_range(0.3, 0.42))
	var hgt := 14
	var c := path_center[z0 + hgt / 2]
	var x0 := clampi(c - 8, 2, W - 19)
	var x1 := x0 + 16
	indoor_rect = Rect2i(x0, z0, x1 - x0 + 1, hgt)
	_carve_rect(x0, z0, x1, z0 + hgt - 1)
	# pillars every 4 cells
	for z in range(z0 + 2, z0 + hgt - 2, 4):
		for x in range(x0 + 2, x1 - 1, 4):
			_setc(x, z, T_WALL)
	# shelving rows (low obstacles) between pillars
	for z in range(z0 + 4, z0 + hgt - 3, 4):
		for x in range(x0 + 3, x1 - 3):
			if (x - x0) % 4 != 2 and rng.randf() < 0.55 and get_t(x, z) == T_FLOOR:
				_setc(x, z, T_LOW)


func _build_saferooms() -> void:
	var sx := clampi(path_center[8], 5, W - 6)
	start_room = Rect2i(sx - 3, 1, 7, 4)
	_carve_rect(sx - 4, 0, sx + 4, 5, T_SAFE)
	for z in range(1, 5):
		for x in range(sx - 3, sx + 4):
			grid[z * W + x] = T_FLOOR
	start_door = Vector2i(sx, 5)
	grid[5 * W + sx] = T_DOOR
	for z in range(6, 9):
		_setc(sx, z, T_FLOOR)
		_setc(sx - 1, z, T_FLOOR)
		_setc(sx + 1, z, T_FLOOR)
	if is_finale:
		var z0 := H - 24
		_carve_rect(4, z0, W - 5, H - 3)
		rescue_rect = Rect2i(W / 2 - 3, H - 7, 7, 4)
		radio_cell = Vector2i(W / 2, z0 + 6)
		# cover in the arena
		for i in 10:
			var x := rng.randi_range(6, W - 7)
			var z := rng.randi_range(z0 + 3, H - 9)
			if abs(x - radio_cell.x) + abs(z - radio_cell.y) > 3:
				_setc(x, z, T_LOW)
		return
	var ex := clampi(path_center[H - 9], 5, W - 6)
	end_room = Rect2i(ex - 3, H - 5, 7, 4)
	# Wipe anything carved into the end room ring, then rebuild it.
	for z in range(H - 6, H):
		for x in range(ex - 4, ex + 5):
			_setc(x, z, T_SAFE)
	for z in range(H - 5, H - 1):
		for x in range(ex - 3, ex + 4):
			grid[z * W + x] = T_FLOOR
	end_door = Vector2i(ex, H - 6)
	grid[(H - 6) * W + ex] = T_DOOR
	for z in range(H - 9, H - 6):
		_setc(ex, z, T_FLOOR)
		_setc(ex - 1, z, T_FLOOR)
		_setc(ex + 1, z, T_FLOOR)


func _place_gate() -> void:
	var best_row := -1
	var best_count := 999
	for z in range(int(H * 0.55), int(H * 0.68)):
		var cnt := 0
		for x in W:
			if get_t(x, z) == T_FLOOR:
				cnt += 1
		if cnt >= 3 and cnt < best_count:
			best_count = cnt
			best_row = z
	if best_row < 0:
		return
	gate_row = best_row
	var run_start := -1
	for x in range(W + 1):
		var is_f := x < W and get_t(x, gate_row) == T_FLOOR
		if is_f:
			_setc(x, gate_row, T_GATE)
			if run_start < 0:
				run_start = x
		elif run_start >= 0:
			gate_runs.append([run_start, x - 1])
			run_start = -1
	# Clear space in front of the gate and put the button on the left wall.
	var bz := gate_row - 2
	for x in W:
		if get_t(x, bz) == T_FLOOR and is_wallish(get_t(x - 1, bz)):
			gate_button_cell = Vector2i(x, bz)
			break
	if gate_button_cell.x < 0:
		for x in W:
			if get_t(x, bz) == T_FLOOR:
				gate_button_cell = Vector2i(x, bz)
				break


func _connected() -> bool:
	# Start door outside cell -> end (or finale arena), gates treated as open.
	var start := Vector2i(start_door.x, start_door.y + 1)
	var goal := radio_cell if is_finale else Vector2i(end_door.x, end_door.y - 1)
	var seen := PackedByteArray()
	seen.resize(W * H)
	var q := [start]
	seen[idx(start)] = 1
	while q.size() > 0:
		var c: Vector2i = q.pop_back()
		if c == goal:
			return true
		for o in [Vector2i(1, 0), Vector2i(-1, 0), Vector2i(0, 1), Vector2i(0, -1)]:
			var n: Vector2i = c + o
			if not in_bounds(n) or seen[idx(n)]:
				continue
			var t := grid[idx(n)]
			if t == T_FLOOR or t == T_GATE:
				seen[idx(n)] = 1
				q.append(n)
	return false


var obstacle_list: Array = []  # [type, cells(Array), rot]

func _place_obstacles() -> void:
	var placed := 0
	var alarms := 0
	var tries := 0
	var want := 26 if not is_finale else 18
	while placed < want and tries < 400:
		tries += 1
		var x := rng.randi_range(2, W - 3)
		var z := rng.randi_range(10, H - 11)
		if abs(z - gate_row) <= 3:
			continue
		if get_t(x, z) != T_FLOOR:
			continue
		var roll := rng.randf()
		var cells: Array = []
		var typ := ""
		var rot := 0.0
		if roll < 0.55:
			typ = "car"
			if rng.randf() < 0.7:
				cells = [Vector2i(x, z), Vector2i(x, z + 1)]
			else:
				cells = [Vector2i(x, z), Vector2i(x + 1, z)]
				rot = PI / 2
		elif roll < 0.75:
			typ = "dumpster"
			cells = [Vector2i(x, z)]
		elif roll < 0.9:
			typ = "crates"
			cells = [Vector2i(x, z)]
		else:
			typ = "barrier"
			cells = [Vector2i(x, z)]
		var ok := true
		for c in cells:
			if get_t(c.x, c.y) != T_FLOOR:
				ok = false
				break
			# keep a ring of floor around so streets don't get sealed
			var free := 0
			for oz in [-1, 0, 1]:
				for ox in [-1, 0, 1]:
					if get_t(c.x + ox, c.y + oz) == T_FLOOR:
						free += 1
			if free < 6:
				ok = false
		if not ok:
			continue
		for c in cells:
			_setc(c.x, c.y, T_LOW)
		if not _connected():
			for c in cells:
				_setc(c.x, c.y, T_FLOOR)
			continue
		var alarm := typ == "car" and alarms < 2 and rng.randf() < 0.25
		if alarm:
			alarms += 1
		obstacle_list.append([typ, cells, rot, alarm])
		placed += 1


func _finalize_walk() -> void:
	walk.resize(W * H)
	for i in W * H:
		var t := grid[i]
		walk[i] = 1 if t == T_FLOOR else 0
	# Doors start closed (start) / open (end); gates closed.


func _compute_flow() -> void:
	var f := FlowField.new(self)
	# Temporarily open gates + doors for the progress metric.
	var saved := walk.duplicate()
	for i in W * H:
		if grid[i] == T_GATE or grid[i] == T_DOOR:
			walk[i] = 1
	f.compute([start_door])
	walk = saved
	flow = f.dist
	max_flow = 1
	floor_by_flow.clear()
	for i in W * H:
		var v := flow[i]
		if v < FlowField.UNREACHED and grid[i] == T_FLOOR:
			max_flow = max(max_flow, v)
			while floor_by_flow.size() <= v:
				floor_by_flow.append([])
			floor_by_flow[v].append(i)


func _pick_heights() -> void:
	var block_h := {}
	for i in W * H:
		var x := i % W
		var z := i / W
		var t := grid[i]
		if t == T_SAFE:
			heights[i] = 3.2
		elif t == T_WALL:
			if indoor_rect.has_point(Vector2i(x, z)):
				heights[i] = 7.0
			else:
				var key := Vector2i(x / 4, z / 4)
				if not block_h.has(key):
					block_h[key] = rng.randf_range(6.0, 18.0)
				heights[i] = block_h[key]


# ================================================================ geometry

func _build_geometry() -> void:
	var st_city := SurfaceTool.new()
	st_city.begin(Mesh.PRIMITIVE_TRIANGLES)
	var st_safe := SurfaceTool.new()
	st_safe.begin(Mesh.PRIMITIVE_TRIANGLES)
	var st_pillar := SurfaceTool.new()
	st_pillar.begin(Mesh.PRIMITIVE_TRIANGLES)
	var walls_body := StaticBody3D.new()
	walls_body.collision_layer = Game.LAYER_WORLD
	add_child(walls_body)
	for z in H:
		var run_start := -1
		for x in range(W + 1):
			var boundary := false
			if x < W:
				var t := grid[z * W + x]
				if is_wallish(t):
					for o in [Vector2i(1, 0), Vector2i(-1, 0), Vector2i(0, 1), Vector2i(0, -1)]:
						var nt := get_t(x + o.x, z + o.y)
						if not is_wallish(nt) and in_bounds(Vector2i(x + o.x, z + o.y)):
							boundary = true
							break
					if boundary:
						var h := heights[z * W + x]
						var aabb := AABB(Vector3(x * CELL, 0, z * CELL), Vector3(CELL, h, CELL))
						if t == T_SAFE:
							_add_box(st_safe, aabb)
						elif indoor_rect.has_point(Vector2i(x, z)):
							_add_box(st_pillar, aabb)
						else:
							_add_box(st_city, aabb)
			if boundary and run_start < 0:
				run_start = x
			elif not boundary and run_start >= 0:
				var cs := CollisionShape3D.new()
				var shape := BoxShape3D.new()
				var len := (x - run_start) * CELL
				shape.size = Vector3(len, 20.0, CELL)
				cs.shape = shape
				cs.position = Vector3(run_start * CELL + len * 0.5, 10.0, z * CELL + CELL * 0.5)
				walls_body.add_child(cs)
				run_start = -1
	for pair in [[st_city, Mats.facade()], [st_safe, Mats.saferoom_wall()], [st_pillar, Mats.concrete()]]:
		var st: SurfaceTool = pair[0]
		var mi := MeshInstance3D.new()
		mi.mesh = st.commit()
		mi.material_override = pair[1]
		add_child(mi)

	# Ground
	var ground := StaticBody3D.new()
	ground.collision_layer = Game.LAYER_WORLD
	add_child(ground)
	var gcs := CollisionShape3D.new()
	var gshape := BoxShape3D.new()
	gshape.size = Vector3(W * CELL, 1.0, H * CELL)
	gcs.shape = gshape
	gcs.position = Vector3(W * CELL * 0.5, -0.5, H * CELL * 0.5)
	ground.add_child(gcs)
	var gm := PlaneMesh.new()
	gm.size = Vector2(W * CELL, H * CELL)
	Mats.add_mesh(self, gm, Mats.asphalt(), Vector3(W * CELL * 0.5, 0, H * CELL * 0.5))

	# Saferoom floors + ceilings + lights
	for room in [start_room, end_room]:
		if room.size.x == 0:
			continue
		var fm := PlaneMesh.new()
		fm.size = Vector2(room.size.x * CELL, room.size.y * CELL)
		var center := Vector3((room.position.x + room.size.x * 0.5) * CELL, 0.01, (room.position.y + room.size.y * 0.5) * CELL)
		Mats.add_mesh(self, fm, Mats.tiles(), center)
		Mats.add_mesh(self, Mats.box(Vector3((room.size.x + 2) * CELL, 0.2, (room.size.y + 2) * CELL)), Mats.saferoom_wall(), center + Vector3(0, 3.3, 0))
		var l := OmniLight3D.new()
		l.light_color = Color(1.0, 0.85, 0.6)
		l.light_energy = 1.4
		l.omni_range = 10.0
		l.position = center + Vector3(0, 2.8, 0)
		add_child(l)
		Mats.add_mesh(self, Mats.box(Vector3(0.8, 0.05, 0.3)), Mats.emissive(Color(1, 0.9, 0.7), 3.0), center + Vector3(0, 3.18, 0))

	# Warehouse roof (visual only)
	if indoor_rect.size.x > 0:
		var roof := Mats.box(Vector3(indoor_rect.size.x * CELL + 4, 0.4, indoor_rect.size.y * CELL + 4))
		var rc := Vector3((indoor_rect.position.x + indoor_rect.size.x * 0.5) * CELL, 7.2, (indoor_rect.position.y + indoor_rect.size.y * 0.5) * CELL)
		Mats.add_mesh(self, roof, Mats.concrete(), rc)
		for i in 3:
			var l := OmniLight3D.new()
			l.light_color = Color(0.7, 0.8, 1.0)
			l.light_energy = 1.2
			l.omni_range = 12.0
			l.position = rc + Vector3(0, -1.0, (i - 1) * indoor_rect.size.y * CELL * 0.33)
			add_child(l)
			var f := Props.Flicker.new()
			f.light = l
			f.base = 1.2
			add_child(f)

	# Doors
	if start_room.size.x == 0:
		return  # sandbox arena: no saferooms
	start_door_node = Props.Door.new()
	start_door_node.setup(self, start_door, false, false)
	start_door_node.position = cell_center(start_door)
	add_child(start_door_node)
	if not is_finale:
		end_door_node = Props.Door.new()
		end_door_node.setup(self, end_door, true, true)
		end_door_node.position = cell_center(end_door)
		add_child(end_door_node)

	# Gate
	for run in gate_runs:
		var g := Node3D.new()
		var x0: int = run[0]
		var x1: int = run[1]
		var width := (x1 - x0 + 1) * CELL
		g.position = Vector3(x0 * CELL + width * 0.5, 0, gate_row * CELL + CELL * 0.5)
		add_child(g)
		Mats.add_mesh(g, Mats.box(Vector3(width, 3.0, 0.05)), Mats.fence(), Vector3(0, 1.5, 0))
		Mats.add_mesh(g, Mats.box(Vector3(width, 0.1, 0.1)), Mats.color(Color(0.4, 0.4, 0.42), 0.4, 0.8), Vector3(0, 3.0, 0))
		var body := StaticBody3D.new()
		body.collision_layer = Game.LAYER_WORLD
		g.add_child(body)
		var cs := CollisionShape3D.new()
		var shape := BoxShape3D.new()
		shape.size = Vector3(width, 3.0, 0.3)
		cs.shape = shape
		cs.position.y = 1.5
		body.add_child(cs)
		gate_nodes.append(g)
	if gate_button_cell.x >= 0:
		var b := Props.GateButton.new()
		b.position = cell_center(gate_button_cell) + Vector3(-0.8, 0, 0)
		add_child(b)

	# Finale props
	if is_finale:
		var r := Props.Radio.new()
		r.position = cell_center(radio_cell)
		add_child(r)
		var zone := MeshInstance3D.new()
		var zm := BoxMesh.new()
		zm.size = Vector3(rescue_rect.size.x * CELL, 0.05, rescue_rect.size.y * CELL)
		zone.mesh = zm
		zone.material_override = Mats.unshaded(Color(0.2, 1.0, 0.3, 0.0), true)
		zone.position = cell_center(rescue_rect.get_center()) + Vector3(0, 0.03, 0)
		zone.name = "RescueZone"
		add_child(zone)

	# Obstacles
	var car_cols := [Color(0.5, 0.1, 0.1), Color(0.2, 0.25, 0.4), Color(0.6, 0.6, 0.55), Color(0.15, 0.15, 0.15), Color(0.35, 0.4, 0.3), Color(0.55, 0.45, 0.2)]
	for ob in obstacle_list:
		var cells: Array = ob[1]
		var center := Vector3.ZERO
		for c in cells:
			center += cell_center(c)
		center /= cells.size()
		match ob[0]:
			"car": Props.car(self, center, ob[2] + (PI if rng.randf() < 0.5 else 0.0) + rng.randf_range(-0.15, 0.15), car_cols[rng.randi() % car_cols.size()], ob[3])
			"dumpster": Props.dumpster(self, center, rng.randf_range(-0.3, 0.3))
			"crates": Props.crates(self, center)
			"barrier": Props.barrier(self, center, rng.randf() * PI)
	# Warehouse shelving / finale cover were set straight into the grid.
	for i in W * H:
		if grid[i] == T_LOW:
			var c := Vector2i(i % W, i / W)
			var claimed := false
			for ob in obstacle_list:
				if c in ob[1]:
					claimed = true
					break
			if not claimed:
				if indoor_rect.has_point(c):
					var body := Props.static_box(self, cell_center(c), Vector3(1.9, 2.2, 1.0))
					Mats.add_mesh(body, Mats.box(Vector3(1.9, 2.2, 1.0)), Mats.color(Color(0.3, 0.32, 0.35), 0.6, 0.5), Vector3(0, 1.1, 0))
					Mats.add_mesh(body, Mats.box(Vector3(1.6, 0.5, 0.8)), Mats.color(Color(0.45, 0.35, 0.2)), Vector3(0, 1.5, 0))
				else:
					Props.barrier(self, cell_center(c), rng.randf() * PI)


func _add_box(st: SurfaceTool, b: AABB) -> void:
	var p := b.position
	var e := b.end
	var faces := [
		# normal, 4 corners (counter-clockwise when looking at the face)
		[Vector3(0, 0, -1), [Vector3(e.x, p.y, p.z), Vector3(p.x, p.y, p.z), Vector3(p.x, e.y, p.z), Vector3(e.x, e.y, p.z)]],
		[Vector3(0, 0, 1), [Vector3(p.x, p.y, e.z), Vector3(e.x, p.y, e.z), Vector3(e.x, e.y, e.z), Vector3(p.x, e.y, e.z)]],
		[Vector3(-1, 0, 0), [Vector3(p.x, p.y, p.z), Vector3(p.x, p.y, e.z), Vector3(p.x, e.y, e.z), Vector3(p.x, e.y, p.z)]],
		[Vector3(1, 0, 0), [Vector3(e.x, p.y, e.z), Vector3(e.x, p.y, p.z), Vector3(e.x, e.y, p.z), Vector3(e.x, e.y, e.z)]],
		[Vector3(0, 1, 0), [Vector3(p.x, e.y, e.z), Vector3(e.x, e.y, e.z), Vector3(e.x, e.y, p.z), Vector3(p.x, e.y, p.z)]],
	]
	for f in faces:
		var n: Vector3 = f[0]
		var v: Array = f[1]
		for k in [0, 2, 1, 0, 3, 2]:
			st.set_normal(n)
			st.add_vertex(v[k])


func _place_lamps() -> void:
	var z := 12
	var count := 0
	while z < H - 10:
		var cx := path_center[z]
		var x := cx
		var side := 1 if count % 2 == 0 else -1
		while get_t(x + side, z) == T_FLOOR or get_t(x + side, z) == T_LOW:
			x += side
		if get_t(x, z) == T_FLOOR:
			var pos := cell_center(Vector2i(x, z)) + Vector3(side * 0.7, 0, 0)
			Props.lamp(self, pos, pos - Vector3(side * 2.0, 0, 0), rng.randf() < 0.3)
		count += 1
		z += rng.randi_range(9, 13)


func _random_floor_near_wall(f0: float, f1: float) -> Vector2i:
	for attempt in 80:
		var f := int(lerp(f0, f1, rng.randf()) * max_flow)
		f = clampi(f, 0, floor_by_flow.size() - 1)
		var bucket: Array = floor_by_flow[f]
		if bucket.is_empty():
			continue
		var i: int = bucket[rng.randi() % bucket.size()]
		var c := Vector2i(i % W, i / W)
		var near_wall := false
		for o in [Vector2i(1, 0), Vector2i(-1, 0), Vector2i(0, 1), Vector2i(0, -1)]:
			if is_wallish(get_t(c.x + o.x, c.y + o.y)):
				near_wall = true
		if near_wall and abs(c.y - gate_row) > 1:
			return c
	return Vector2i(-1, -1)


func _place_items() -> void:
	# Start saferoom: weapons table, ammo, (map 1) nothing else; later maps get T2.
	var r := start_room
	var table_z := (r.position.y + 1) * CELL + 0.2
	var tx := (r.position.x + 0.5) * CELL
	var table := Props.static_box(self, Vector3(tx + 2.0, 0, table_z), Vector3(4.5, 0.8, 1.0))
	Mats.add_mesh(table, Mats.box(Vector3(4.5, 0.08, 1.0)), Mats.color(Color(0.35, 0.25, 0.15)), Vector3(0, 0.78, 0))
	var weapons := ["smg", "pump_shotgun"] if map_index == 0 else ["assault_rifle", "auto_shotgun", "hunting_rifle", "smg"]
	var wx := tx
	for w in weapons:
		add_child(Pickup.create(w, Vector3(wx, 0.82, table_z)))
		wx += 1.1
	add_child(Pickup.create("ammo", cell_center(Vector2i(r.end.x - 1, r.position.y + 1))))
	if map_index > 0:
		for i in 4:
			add_child(Pickup.create("medkit", cell_center(Vector2i(r.end.x - 1, r.position.y + 2)) + Vector3(-0.4 + i * 0.3, 0, -0.5)))
	else:
		add_child(Pickup.create("magnum", cell_center(Vector2i(r.end.x - 2, r.position.y + 1))))
	# End saferoom: medkits + ammo + T2.
	if not is_finale:
		var e := end_room
		for i in 4:
			add_child(Pickup.create("medkit", cell_center(Vector2i(e.position.x + 1, e.end.y - 1)) + Vector3(-0.45 + i * 0.3, 0, 0)))
		add_child(Pickup.create("ammo", cell_center(Vector2i(e.end.x - 1, e.end.y - 1))))
		add_child(Pickup.create("assault_rifle", cell_center(Vector2i(e.end.x - 2, e.end.y - 1))))
		add_child(Pickup.create("auto_shotgun", cell_center(Vector2i(e.end.x - 3, e.end.y - 1))))
	else:
		add_child(Pickup.create("ammo", cell_center(radio_cell + Vector2i(2, 0))))
		add_child(Pickup.create("ammo", cell_center(radio_cell + Vector2i(-2, -1))))
		for i in 2:
			add_child(Pickup.create("pills", cell_center(radio_cell + Vector2i(0, -2)) + Vector3(i * 0.4, 0, 0)))
		add_child(Pickup.create("pipe_bomb", cell_center(radio_cell + Vector2i(1, -2))))
		add_child(Pickup.create("molotov", cell_center(radio_cell + Vector2i(-1, -2))))
	# Along the way
	var scatter := [
		["ammo", 0.45], ["ammo", 0.75],
		["pills", 0.2], ["pills", 0.5], ["pills", 0.8],
		["medkit", 0.6],
		["pipe_bomb", 0.25], ["molotov", 0.4], ["bile_jar", 0.65], ["pipe_bomb", 0.85],
		["machete", 0.15], ["dual_pistols", 0.3],
	]
	if map_index > 0:
		scatter.append(["hunting_rifle", 0.35])
		scatter.append(["assault_rifle", 0.55])
	for s in scatter:
		var c := _random_floor_near_wall(s[1] - 0.06, s[1] + 0.06)
		if c.x >= 0:
			add_child(Pickup.create(s[0], cell_center(c) + Vector3(rng.randf_range(-0.4, 0.4), 0, rng.randf_range(-0.4, 0.4))))
	# Spawn positions for survivors
	spawn_points.clear()
	for i in 4:
		spawn_points.append(cell_center(Vector2i(r.position.x + 1 + i, r.position.y + 2)) + Vector3(0, 0.1, 0))


func _place_witch_spots() -> void:
	witch_spots.clear()
	var n := rng.randi_range(0, 2) if map_index > 0 else rng.randi_range(0, 1)
	for i in n:
		var c := _random_floor_near_wall(0.25 + i * 0.35, 0.45 + i * 0.35)
		if c.x >= 0:
			witch_spots.append(cell_center(c))


# ================================================================ dynamic fields

func survivor_cells(only_biled := false) -> Array:
	var out := []
	for s in Game.survivors:
		if is_instance_valid(s) and not s.dead:
			if only_biled and s.biled_time <= 0.0:
				continue
			out.append(cell_of(s.global_position))
	return out


func _physics_process(delta: float) -> void:
	_field_t -= delta
	if _field_t <= 0.0:
		_field_t = 0.25
		field_survivors.compute(survivor_cells())
		var biled := survivor_cells(true)
		if not biled.is_empty():
			field_special.compute(biled)
		var key := ""
		var srcs := []
		for a in Game.attractors:
			if is_instance_valid(a):
				var c := cell_of(a.global_position)
				srcs.append(c)
				key += str(c)
		if key != _attractor_key:
			_attractor_key = key
			if not srcs.is_empty():
				field_attract.compute(srcs)
	_player_field_t -= delta
	if _player_field_t <= 0.0 and Game.player and is_instance_valid(Game.player):
		_player_field_t = 0.35
		field_player.compute([cell_of(Game.player.global_position)])


func any_biled() -> bool:
	for s in Game.survivors:
		if is_instance_valid(s) and not s.dead and s.biled_time > 0.0:
			return true
	return false


func open_gate() -> void:
	for run in gate_runs:
		for x in range(run[0], run[1] + 1):
			walk[gate_row * W + x] = 1
			grid[gate_row * W + x] = T_FLOOR
	for g in gate_nodes:
		var tw := create_tween()
		tw.tween_property(g, "position:y", -3.2, 2.5)
		for c in g.get_children():
			if c is StaticBody3D:
				for cs in c.get_children():
					cs.set_deferred("disabled", true)


func in_end_room(p: Vector3) -> bool:
	if is_finale:
		return false
	return end_room.has_point(cell_of(p))


func in_rescue_zone(p: Vector3) -> bool:
	return is_finale and rescue_rect.has_point(cell_of(p))


## Random walkable cell whose progress is within [f0, f1] cells of flow.
func random_cell_in_flow(f0: int, f1: int) -> Vector2i:
	f0 = clampi(f0, 0, floor_by_flow.size() - 1)
	f1 = clampi(f1, 0, floor_by_flow.size() - 1)
	if f1 < f0:
		return Vector2i(-1, -1)
	for attempt in 6:
		var f := rng.randi_range(f0, f1)
		var bucket: Array = floor_by_flow[f]
		if bucket.is_empty():
			continue
		var i: int = bucket[rng.randi() % bucket.size()]
		if walk[i] == 1:
			return Vector2i(i % W, i / W)
	return Vector2i(-1, -1)
