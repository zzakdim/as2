class_name Props
## Placeholder world props: cars, dumpsters, crates, lamps, doors, gate, radio.


static func static_box(parent: Node3D, pos: Vector3, size: Vector3, rot_y := 0.0) -> StaticBody3D:
	var body := StaticBody3D.new()
	body.collision_layer = Game.LAYER_WORLD
	body.collision_mask = 0
	body.position = pos
	body.rotation.y = rot_y
	var cs := CollisionShape3D.new()
	var shape := BoxShape3D.new()
	shape.size = size
	cs.shape = shape
	cs.position.y = size.y * 0.5
	body.add_child(cs)
	parent.add_child(body)
	return body


const CAR_MODELS := ["NormalCar1", "NormalCar2", "SUV", "NormalCar1", "NormalCar2", "SportsCar", "Taxi", "Cop"]
const CAR_TRIM := ["Black", "Grey", "Headlights", "TailLights", "Windows", "BlueLights", "WhiteLights"]
static var _car_meshes := {}


static func car(parent: Node3D, pos: Vector3, rot_y: float, col: Color, alarm: bool) -> StaticBody3D:
	var mname: String = CAR_MODELS[randi() % CAR_MODELS.size()]
	var path := "res://assets/quaternius/cars/%s.obj" % mname
	if not ResourceLoader.exists(path):
		return _box_car(parent, pos, rot_y, col, alarm)
	if not _car_meshes.has(path):
		_car_meshes[path] = load(path)
	var mesh: Mesh = _car_meshes[path]
	var bb := mesh.get_aabb()
	var body := static_box(parent, pos, Vector3(bb.size.x, bb.size.y * 0.9, bb.size.z), rot_y)
	var mi := MeshInstance3D.new()
	mi.mesh = mesh
	mi.rotation.y = PI      # the models face +Z; our cars face -Z
	body.add_child(mi)
	# Abandoned cars: repaint the body (taxis and cruisers keep their livery),
	# dull everything down a bit.
	var keep_paint := mname == "Taxi" or mname == "Cop"
	for i in mesh.get_surface_count():
		var m := mesh.surface_get_material(i)
		var nm := m.resource_name if m else ""
		if nm == "":
			nm = mesh.surface_get_name(i)
		if nm == "Windows":
			mi.set_surface_override_material(i, Mats.color(Color(0.05, 0.07, 0.09), 0.08, 0.4))
		elif not keep_paint and not nm in CAR_TRIM:
			mi.set_surface_override_material(i, Mats.color(col, 0.45, 0.35))
	if alarm:
		var blink := CarAlarm.new()
		body.add_child(blink)
		body.set_meta("alarm", blink)
	return body


static func _box_car(parent: Node3D, pos: Vector3, rot_y: float, col: Color, alarm: bool) -> StaticBody3D:
	var body := static_box(parent, pos, Vector3(1.9, 1.4, 4.2), rot_y)
	var paint := Mats.color(col, 0.35, 0.4)
	var glass := Mats.color(Color(0.08, 0.1, 0.12), 0.1, 0.3)
	var tire := Mats.color(Color(0.06, 0.06, 0.06))
	Mats.add_mesh(body, Mats.box(Vector3(1.9, 0.7, 4.2)), paint, Vector3(0, 0.6, 0))
	Mats.add_mesh(body, Mats.box(Vector3(1.7, 0.6, 2.2)), glass, Vector3(0, 1.2, 0.2))
	Mats.add_mesh(body, Mats.box(Vector3(1.72, 0.06, 2.0)), paint, Vector3(0, 1.52, 0.2))
	for wx in [-0.85, 0.85]:
		for wz in [-1.3, 1.3]:
			Mats.add_mesh(body, Mats.cylinder(0.36, 0.25), tire, Vector3(wx, 0.36, wz), Vector3(0, 0, PI / 2))
	Mats.add_mesh(body, Mats.box(Vector3(0.3, 0.12, 0.05)), Mats.emissive(Color(1, 0.95, 0.8), 0.6), Vector3(-0.6, 0.7, -2.11))
	Mats.add_mesh(body, Mats.box(Vector3(0.3, 0.12, 0.05)), Mats.emissive(Color(1, 0.95, 0.8), 0.6), Vector3(0.6, 0.7, -2.11))
	if alarm:
		var blink := CarAlarm.new()
		body.add_child(blink)
		body.set_meta("alarm", blink)
	return body


static func dumpster(parent: Node3D, pos: Vector3, rot_y: float) -> void:
	var body := static_box(parent, pos, Vector3(1.8, 1.3, 1.2), rot_y)
	Mats.add_mesh(body, Mats.box(Vector3(1.8, 1.2, 1.2)), Mats.color(Color(0.12, 0.3, 0.16), 0.6, 0.3), Vector3(0, 0.6, 0))
	Mats.add_mesh(body, Mats.box(Vector3(1.85, 0.08, 1.25)), Mats.color(Color(0.08, 0.08, 0.08)), Vector3(0, 1.25, 0))


static func crates(parent: Node3D, pos: Vector3) -> void:
	var body := static_box(parent, pos, Vector3(1.6, 1.2, 1.6), randf() * TAU)
	var wood := Mats.color(Color(0.42, 0.3, 0.17))
	Mats.add_mesh(body, Mats.box(Vector3(1.0, 1.0, 1.0)), wood, Vector3(-0.3, 0.5, -0.2))
	Mats.add_mesh(body, Mats.box(Vector3(0.7, 0.7, 0.7)), wood, Vector3(0.4, 0.35, 0.35), Vector3(0, 0.4, 0))
	Mats.add_mesh(body, Mats.box(Vector3(0.6, 0.6, 0.6)), wood, Vector3(-0.2, 1.3, -0.1), Vector3(0, 0.8, 0))


static func barrier(parent: Node3D, pos: Vector3, rot_y: float) -> void:
	var body := static_box(parent, pos, Vector3(1.8, 1.0, 0.6), rot_y)
	Mats.add_mesh(body, Mats.box(Vector3(1.8, 0.9, 0.5)), Mats.concrete(), Vector3(0, 0.45, 0))


static func lamp(parent: Node3D, pos: Vector3, toward: Vector3, flicker: bool) -> OmniLight3D:
	var n := Node3D.new()
	n.position = pos
	parent.add_child(n)
	var metal := Mats.color(Color(0.15, 0.15, 0.16), 0.5, 0.6)
	Mats.add_mesh(n, Mats.cylinder(0.08, 6.0, 6), metal, Vector3(0, 3.0, 0))
	var arm_dir := (toward - pos).normalized() * 1.0
	Mats.add_mesh(n, Mats.box(Vector3(0.1, 0.1, 1.2)), metal, Vector3(arm_dir.x * 0.5, 5.9, arm_dir.z * 0.5), Vector3(0, atan2(arm_dir.x, arm_dir.z), 0))
	Mats.add_mesh(n, Mats.box(Vector3(0.4, 0.12, 0.25)), Mats.emissive(Color(1.0, 0.75, 0.45), 4.0), Vector3(arm_dir.x, 5.82, arm_dir.z))
	var l := OmniLight3D.new()
	l.light_color = Color(1.0, 0.72, 0.42)
	l.light_energy = 2.2
	l.omni_range = 13.0
	l.omni_attenuation = 1.2
	l.position = Vector3(arm_dir.x, 5.4, arm_dir.z)
	l.shadow_enabled = false
	n.add_child(l)
	if flicker:
		var f := Flicker.new()
		f.light = l
		n.add_child(f)
	return l


class Flicker extends Node:
	var light: OmniLight3D
	var base := 2.2
	var t := 0.0
	func _process(delta: float) -> void:
		t -= delta
		if t <= 0:
			t = randf_range(0.03, 0.4)
			light.light_energy = base if randf() < 0.7 else randf_range(0.0, 0.6)


## Blinking hazard light; shooting the car sets off the alarm and calls a mob.
class CarAlarm extends Node3D:
	var triggered := false
	var lamp: MeshInstance3D
	var t := 0.0
	var sound: AudioStreamPlayer3D
	func _ready() -> void:
		lamp = Mats.add_mesh(self, Mats.box(Vector3(0.12, 0.08, 0.12)), Mats.emissive(Color(1, 0.15, 0.1), 3.0), Vector3(0, 0.98, -0.45))   # on the dash
	func _process(delta: float) -> void:
		t += delta
		lamp.visible = fmod(t, 1.4 if not triggered else 0.4) < 0.15
	func trigger() -> void:
		if triggered:
			return
		triggered = true
		sound = Game.sfx.start_loop("car_alarm", self, 2.0)
		Game.director.spawn_mob(Game.mob_size() + 6, "alarm")
		Game.callout(Game.nearest_survivor(global_position), "Who shot the car?!")
		Effects.after(sound, 20.0, sound.queue_free)


## Rescue closet: a dead teammate bangs on this door further along the map;
## opening it brings them back (L4D2).
class RescueCloset extends Usable:
	var who = null              # dead survivor waiting inside
	var outward := Vector3.FORWARD
	var hinge: Node3D
	var bang_t := 1.0
	var opened := false

	func _ready() -> void:
		use_radius = 2.4
		var frame_m := Mats.color(Color(0.2, 0.2, 0.21), 0.6, 0.4)
		var door_m := Mats.color(Color(0.32, 0.3, 0.26), 0.55, 0.3)
		Mats.add_mesh(self, Mats.box(Vector3(1.4, 2.5, 0.12)), frame_m, Vector3(0, 1.25, -0.02))
		hinge = Node3D.new()
		hinge.position = Vector3(-0.55, 0, 0.06)
		add_child(hinge)
		Mats.add_mesh(hinge, Mats.box(Vector3(1.1, 2.2, 0.06)), door_m, Vector3(0.55, 1.1, 0))
		Mats.add_mesh(hinge, Mats.box(Vector3(0.12, 0.05, 0.08)), Mats.color(Color(0.7, 0.7, 0.7), 0.3, 0.9), Vector3(0.95, 1.05, 0.04))
		# A dim light leaking out so it's findable.
		var l := OmniLight3D.new()
		l.light_color = Color(1.0, 0.8, 0.5)
		l.light_energy = 0.8
		l.omni_range = 3.5
		l.position = Vector3(0, 2.4, 0.5)
		add_child(l)

	func use_point() -> Vector3:
		return global_position + Vector3(0, 1.2, 0)

	func get_prompt(_s) -> String:
		return "Open the closet (%s)" % (who.survivor_name if who and is_instance_valid(who) else "")

	func can_use(_s) -> bool:
		return enabled and not opened

	func on_use(_s) -> void:
		if opened:
			return
		opened = true
		enabled = false
		Game.sfx.play3d("door", global_position + Vector3(0, 1.2, 0), 0.0)
		var tw := hinge.create_tween()
		tw.tween_property(hinge, "rotation:y", -1.9, 0.35)
		if who and is_instance_valid(who):
			who.respawn_at(global_position + outward * 0.9 + Vector3(0, 0.1, 0), outward)

	func _process(delta: float) -> void:
		if opened:
			return
		bang_t -= delta
		if bang_t <= 0.0:
			bang_t = randf_range(0.8, 2.2)
			Game.sfx.play3d("tank_punch", global_position + Vector3(0, 1.3, 0), -12.0, 0.2)
			hinge.position.z = 0.06 + 0.02
			var tw := hinge.create_tween()
			tw.tween_property(hinge, "position:z", 0.06, 0.12)


class Door extends Usable:
	var is_open := false
	var hinge: Node3D
	var col: CollisionShape3D
	var cell := Vector2i.ZERO
	var level
	var is_end_door := false
	var locked := false
	var axis_x := true

	func setup(lvl, c: Vector2i, open: bool, end_door: bool) -> void:
		level = lvl
		cell = c
		is_end_door = end_door
		is_open = open

	func _ready() -> void:
		hold_time = 0.0
		use_radius = 2.4
		hinge = Node3D.new()
		hinge.position = Vector3(-1.0, 0, 0)
		add_child(hinge)
		var red := Mats.color(Color(0.55, 0.08, 0.06), 0.5, 0.5)
		Mats.add_mesh(hinge, Mats.box(Vector3(2.0, 2.6, 0.12)), red, Vector3(1.0, 1.3, 0))
		Mats.add_mesh(hinge, Mats.box(Vector3(0.6, 0.4, 0.14)), Mats.color(Color(0.1, 0.1, 0.1), 0.2, 0.3), Vector3(1.0, 1.8, 0))
		Mats.add_mesh(hinge, Mats.box(Vector3(0.2, 0.06, 0.2)), Mats.color(Color(0.7, 0.7, 0.7), 0.3, 0.9), Vector3(1.7, 1.15, 0))
		var body := StaticBody3D.new()
		body.collision_layer = Game.LAYER_WORLD
		hinge.add_child(body)
		col = CollisionShape3D.new()
		var shape := BoxShape3D.new()
		shape.size = Vector3(2.0, 2.6, 0.2)
		col.shape = shape
		col.position = Vector3(1.0, 1.3, 0)
		body.add_child(col)
		_apply(true)

	func use_point() -> Vector3:
		return global_position + Vector3(0, 1.2, 0)

	func get_prompt(_s) -> String:
		return "Close door" if is_open else "Open door"

	func can_use(_s) -> bool:
		return enabled and not locked

	func on_use(_s) -> void:
		is_open = not is_open
		_apply(false)
		Game.sfx.play3d("door", global_position, 0.0)
		if is_end_door and not is_open:
			Game.director.check_end_saferoom()

	func _apply(instant: bool) -> void:
		var target := -PI * 0.55 if is_open else 0.0
		if instant:
			hinge.rotation.y = target
		else:
			var tw := create_tween()
			tw.tween_property(hinge, "rotation:y", target, 0.35)
		col.set_deferred("disabled", is_open)
		level.set_walkable(cell, is_open)


class GateButton extends Usable:
	func _ready() -> void:
		prompt = "Open the gate (starts alarm!)"
		Mats.add_mesh(self, Mats.box(Vector3(0.4, 0.6, 0.2)), Mats.color(Color(0.4, 0.4, 0.38), 0.5, 0.6), Vector3(0, 1.3, 0))
		Mats.add_mesh(self, Mats.box(Vector3(0.18, 0.18, 0.1)), Mats.emissive(Color(1, 0.2, 0.1), 3.0), Vector3(0, 1.35, -0.12))

	func use_point() -> Vector3:
		return global_position + Vector3(0, 1.3, 0)

	func on_use(_s) -> void:
		enabled = false
		Game.director.start_crescendo()


class Radio extends Usable:
	func _ready() -> void:
		prompt = "Call for rescue on the radio"
		hold_time = 2.0
		Mats.add_mesh(self, Mats.box(Vector3(1.4, 0.8, 0.8)), Mats.color(Color(0.3, 0.3, 0.25)), Vector3(0, 0.4, 0))
		Mats.add_mesh(self, Mats.box(Vector3(0.8, 0.45, 0.5)), Mats.color(Color(0.18, 0.2, 0.16), 0.5, 0.4), Vector3(0, 1.02, 0))
		Mats.add_mesh(self, Mats.box(Vector3(0.3, 0.12, 0.05)), Mats.emissive(Color(0.3, 1.0, 0.3), 2.0), Vector3(0.15, 1.1, -0.26))
		Mats.add_mesh(self, Mats.cylinder(0.015, 1.2, 4), Mats.color(Color(0.2, 0.2, 0.2)), Vector3(-0.3, 1.8, 0))

	func use_point() -> Vector3:
		return global_position + Vector3(0, 1.0, 0)

	func on_use(_s) -> void:
		enabled = false
		Game.director.start_finale()
