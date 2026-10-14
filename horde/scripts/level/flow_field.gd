class_name FlowField
extends RefCounted
## Breadth-first distance field over the level grid. Hordes follow the
## gradient downhill, so one field steers any number of infected.

const UNREACHED := 1 << 29

var level  # Level
var dist := PackedInt32Array()
var _queue := PackedInt32Array()


func _init(lvl) -> void:
	level = lvl
	dist.resize(lvl.W * lvl.H)
	dist.fill(UNREACHED)
	_queue.resize(lvl.W * lvl.H)


## Recompute from a list of source cells (Vector2i).
func compute(sources: Array) -> void:
	var W: int = level.W
	var H: int = level.H
	var walk: PackedByteArray = level.walk
	dist.fill(UNREACHED)
	var head := 0
	var tail := 0
	for c in sources:
		var cell: Vector2i = c
		if cell.x < 0 or cell.y < 0 or cell.x >= W or cell.y >= H:
			continue
		var i := cell.y * W + cell.x
		if dist[i] != 0:
			dist[i] = 0
			_queue[tail] = i
			tail += 1
	while head < tail:
		var i := _queue[head]
		head += 1
		var d := dist[i] + 1
		var x := i % W
		var z := i / W
		if x > 0 and walk[i - 1] and dist[i - 1] > d:
			dist[i - 1] = d; _queue[tail] = i - 1; tail += 1
		if x < W - 1 and walk[i + 1] and dist[i + 1] > d:
			dist[i + 1] = d; _queue[tail] = i + 1; tail += 1
		if z > 0 and walk[i - W] and dist[i - W] > d:
			dist[i - W] = d; _queue[tail] = i - W; tail += 1
		if z < H - 1 and walk[i + W] and dist[i + W] > d:
			dist[i + W] = d; _queue[tail] = i + W; tail += 1


func dist_at(pos: Vector3) -> int:
	var c: Vector2i = level.cell_of(pos)
	if not level.in_bounds(c):
		return UNREACHED
	return dist[c.y * level.W + c.x]


## Unit direction (XZ) to walk downhill from `pos`, or ZERO if unreachable.
func direction(pos: Vector3) -> Vector3:
	var W: int = level.W
	var c: Vector2i = level.cell_of(pos)
	if not level.in_bounds(c):
		return Vector3.ZERO
	var i := c.y * W + c.x
	var here := dist[i]
	if here >= UNREACHED:
		# Standing in a blocked cell (pushed against a wall): step to any open neighbour.
		var best_d := UNREACHED
		var best := Vector2i(-1, -1)
		for o in [Vector2i(1, 0), Vector2i(-1, 0), Vector2i(0, 1), Vector2i(0, -1)]:
			var n: Vector2i = c + o
			if level.in_bounds(n) and dist[n.y * W + n.x] < best_d:
				best_d = dist[n.y * W + n.x]
				best = n
		if best.x < 0:
			return Vector3.ZERO
		return _dir_to(pos, best)
	if here == 0:
		return Vector3.ZERO
	var best_cell := c
	var best_val := float(here)
	for oz in [-1, 0, 1]:
		for ox in [-1, 0, 1]:
			if ox == 0 and oz == 0:
				continue
			var n := Vector2i(c.x + ox, c.y + oz)
			if not level.in_bounds(n):
				continue
			var nd := dist[n.y * W + n.x]
			if nd >= UNREACHED:
				continue
			if ox != 0 and oz != 0:
				# No corner cutting.
				if dist[c.y * W + n.x] >= UNREACHED or dist[n.y * W + c.x] >= UNREACHED:
					continue
				var v := nd - 0.4  # prefer diagonals slightly so paths look less blocky
				if v < best_val:
					best_val = v
					best_cell = n
			elif nd < best_val:
				best_val = nd
				best_cell = n
	if best_cell == c:
		return Vector3.ZERO
	return _dir_to(pos, best_cell)


func _dir_to(pos: Vector3, cell: Vector2i) -> Vector3:
	var t: Vector3 = level.cell_center(cell)
	var d := Vector3(t.x - pos.x, 0, t.z - pos.z)
	if d.length_squared() < 0.0001:
		return Vector3.ZERO
	return d.normalized()
