class_name Effects
extends Node3D
## Pooled visual effects: blood, impacts, tracers, muzzle flashes,
## decals, explosions, fire attached to burning infected.

const MAX_DECALS := 80

var _blood_pool: Array = []
var _blood_i := 0
var _spark_pool: Array = []
var _spark_i := 0
var _decals: Array = []
var _tracer_mat: StandardMaterial3D
var _flash_light: OmniLight3D
var _flash_t := 0.0
var shake := 0.0


func _ready() -> void:
	for i in 24:
		_blood_pool.append(_make_burst(Color(0.32, 0.01, 0.01), 0.028, 7.0, 15.0))
	for i in 12:
		_spark_pool.append(_make_burst(Color(1.0, 0.8, 0.4), 0.03, 6.0, 18.0, true))
	_tracer_mat = Mats.unshaded(Color(1.0, 0.85, 0.5, 0.55), true)
	_flash_light = OmniLight3D.new()
	_flash_light.light_color = Color(1.0, 0.75, 0.4)
	_flash_light.omni_range = 7.0
	_flash_light.light_energy = 0.0
	add_child(_flash_light)


func _make_burst(col: Color, size: float, speed: float, grav: float, emissive := false) -> CPUParticles3D:
	var p := CPUParticles3D.new()
	p.emitting = false
	p.one_shot = true
	p.explosiveness = 0.95
	p.amount = 14
	p.lifetime = 0.6
	p.direction = Vector3.UP
	p.spread = 70.0
	p.initial_velocity_min = speed * 0.3
	p.initial_velocity_max = speed
	p.gravity = Vector3(0, -grav, 0)
	p.scale_amount_min = 0.6
	p.scale_amount_max = 1.4
	var m := BoxMesh.new()
	m.size = Vector3(size, size, size)
	m.material = Mats.emissive(col, 2.0) if emissive else Mats.color(col, 0.3)
	p.mesh = m
	add_child(p)
	return p


## Runs `fn` after `sec` seconds via a Timer owned by `node`, so nothing
## fires if the node (or the whole map) is freed first.
static func after(node: Node, sec: float, fn: Callable) -> void:
	var t := Timer.new()
	t.one_shot = true
	t.wait_time = sec
	t.autostart = true
	t.timeout.connect(fn)
	node.add_child(t)


func _process(delta: float) -> void:
	if _flash_t > 0.0:
		_flash_t -= delta
		_flash_light.light_energy = max(0.0, _flash_t / 0.05) * 2.5
	else:
		_flash_light.light_energy = 0.0
	shake = max(0.0, shake - delta * 2.5)


func blood(pos: Vector3, amount := 8) -> void:
	var p: CPUParticles3D = _blood_pool[_blood_i]
	_blood_i = (_blood_i + 1) % _blood_pool.size()
	p.global_position = pos
	p.rotation = Vector3.ZERO
	p.spread = 70.0
	p.initial_velocity_max = 7.0
	p.amount = clampi(amount, 4, 30)
	p.restart()
	p.emitting = true


## Blood thrown along a direction (the blade's edge or a bullet's path).
func blood_spray(pos: Vector3, dir: Vector3, amount := 12) -> void:
	var p: CPUParticles3D = _blood_pool[_blood_i]
	_blood_i = (_blood_i + 1) % _blood_pool.size()
	p.global_position = pos
	var d := dir.normalized()
	if d.length_squared() > 0.01 and abs(d.dot(Vector3.UP)) < 0.98:
		p.look_at(pos + d, Vector3.UP)
		p.rotate_object_local(Vector3.RIGHT, -PI / 2)
	else:
		p.rotation = Vector3.ZERO
	p.spread = 35.0
	p.initial_velocity_max = 9.0
	p.amount = clampi(amount * 2, 8, 48)
	p.restart()
	p.emitting = true


## Chunks + mist for a split head or a body cut in half.
func gib_burst(pos: Vector3, dir: Vector3, size: float) -> void:
	var p := _make_burst(Color(0.3, 0.02, 0.02), size * 0.22, 5.0, 12.0)
	p.amount = 10
	p.lifetime = 1.0
	p.global_position = pos
	p.restart()
	p.emitting = true
	Effects.after(p, 1.5, p.queue_free)
	blood_spray(pos, dir + Vector3(0, 0.5, 0), 26)


## Continuous arterial spurt; caller parents it and turns it off.
func make_spurt() -> CPUParticles3D:
	var p := CPUParticles3D.new()
	p.amount = 24
	p.lifetime = 0.5
	p.direction = Vector3.UP
	p.spread = 18.0
	p.initial_velocity_min = 2.0
	p.initial_velocity_max = 4.0
	p.gravity = Vector3(0, -12, 0)
	var m := BoxMesh.new()
	m.size = Vector3(0.025, 0.025, 0.025)
	m.material = Mats.color(Color(0.32, 0.01, 0.01), 0.3)
	p.mesh = m
	p.local_coords = false
	return p


func impact(pos: Vector3, normal: Vector3) -> void:
	var p: CPUParticles3D = _spark_pool[_spark_i]
	_spark_i = (_spark_i + 1) % _spark_pool.size()
	p.global_position = pos + normal * 0.03
	if normal.length_squared() > 0.1 and abs(normal.dot(Vector3.UP)) < 0.99:
		p.look_at(pos + normal, Vector3.UP)
		p.rotate_object_local(Vector3.RIGHT, -PI / 2)
	p.amount = 6
	p.restart()
	p.emitting = true


func tracer(a: Vector3, b: Vector3) -> void:
	var len := a.distance_to(b)
	if len < 0.5:
		return
	var mi := MeshInstance3D.new()
	var m := BoxMesh.new()
	m.size = Vector3(0.015, 0.015, min(len, 6.0))
	mi.mesh = m
	mi.material_override = _tracer_mat
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(mi)
	var dir := (b - a) / len
	mi.global_position = a + dir * min(len, 6.0) * 0.5
	if abs(dir.dot(Vector3.UP)) < 0.999:
		mi.look_at(mi.global_position + dir, Vector3.UP)
	var tw := mi.create_tween()
	tw.tween_property(mi, "global_position", b - dir * min(len, 6.0) * 0.5, min(0.08, len / 300.0))
	tw.tween_callback(mi.queue_free)


func muzzle_flash(pos: Vector3, _dir: Vector3) -> void:
	_flash_light.global_position = pos
	_flash_t = 0.05


func blood_decal(pos: Vector3) -> void:
	var d: Decal
	if _decals.size() >= MAX_DECALS:
		d = _decals.pop_front()
	else:
		d = Decal.new()
		d.texture_albedo = Mats.blood_splat()
		d.cull_mask = 1
		add_child(d)
	var s := randf_range(1.2, 2.2)
	d.size = Vector3(s, 1.0, s)
	d.global_position = Vector3(pos.x, 0.3, pos.z)
	d.rotation.y = randf() * TAU
	_decals.append(d)


## Splatter on a nearby wall/car in direction `dir` (raycast up to 3.5 m).
func wall_blood(pos: Vector3, dir: Vector3) -> void:
	var d := dir.normalized()
	var q := PhysicsRayQueryParameters3D.create(pos, pos + d * 3.5, Game.LAYER_WORLD)
	var hit := get_world_3d().direct_space_state.intersect_ray(q)
	if hit.is_empty():
		return
	var n: Vector3 = hit["normal"]
	if abs(n.y) > 0.7:
		return   # floor already gets decals
	var dc: Decal
	if _decals.size() >= MAX_DECALS:
		dc = _decals.pop_front()
	else:
		dc = Decal.new()
		dc.texture_albedo = Mats.blood_splat()
		add_child(dc)
	var sz := randf_range(0.8, 1.6)
	dc.size = Vector3(sz, 0.6, sz)
	dc.global_position = hit["position"]
	# Decals project along their local -Y: point that into the wall.
	var y := n
	var x := y.cross(Vector3.UP).normalized()
	var z := x.cross(y)
	dc.global_basis = Basis(x, y, z).rotated(n, randf() * TAU)
	_decals.append(dc)


func explosion(pos: Vector3, radius: float, damage: float, by) -> void:
	Game.sfx.play3d("explosion", pos, 6.0)
	Game.make_noise(pos, 40.0)
	var light := OmniLight3D.new()
	light.light_color = Color(1.0, 0.6, 0.25)
	light.light_energy = 8.0
	light.omni_range = radius * 3.0
	add_child(light)
	light.global_position = pos + Vector3(0, 1, 0)
	var tw := light.create_tween()
	tw.tween_property(light, "light_energy", 0.0, 0.5)
	tw.tween_callback(light.queue_free)
	var fire := _make_burst(Color(1.0, 0.55, 0.15), 0.25, 12.0, 4.0, true)
	fire.amount = 40
	fire.lifetime = 0.8
	fire.global_position = pos
	fire.restart()
	fire.emitting = true
	Effects.after(fire, 1.5, fire.queue_free)
	for i in 2:
		blood(pos + Vector3(randf_range(-2, 2), 1, randf_range(-2, 2)), 25)
	for z in Game.infected.duplicate():
		if not is_instance_valid(z) or z.is_dead():
			continue
		var d: float = z.global_position.distance_to(pos)
		if d < radius:
			var k: float = 1.0 - d / radius
			var dmg := damage * (0.4 + 0.6 * k)
			if z.kind == "tank":
				dmg *= 0.5
			z.impact_dir = ((z.global_position - pos).normalized() + Vector3(0, 0.8, 0)).normalized()
			z.impact_force = 14.0 * k + 4.0
			z.impact_point = z.global_position + Vector3(0, 0.6, 0)
			z.take_damage(dmg, by, "body", "explosion", z.global_position + Vector3(0, 1, 0))
			if not z.is_dead():
				if k > 0.45 and z.kind == "common":
					z.knockdown(z.global_position - pos, randf_range(1.0, 2.2))
				else:
					z.shove(pos, by)
	for s in Game.survivors:
		if is_instance_valid(s) and not s.dead:
			var d: float = s.global_position.distance_to(pos)
			if d < radius * 0.6:
				s.take_damage(10.0 * (1.0 - d / (radius * 0.6)) * (1.0 + Game.difficulty * 0.5), by, "explosion")
	add_shake(pos, 1.0)


## Expanding ground ring (battle cry).
func shockwave(pos: Vector3, radius: float) -> void:
	var mi := MeshInstance3D.new()
	var t := TorusMesh.new()
	t.inner_radius = 0.85
	t.outer_radius = 1.0
	t.rings = 32
	t.ring_segments = 6
	mi.mesh = t
	var m := StandardMaterial3D.new()
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	m.albedo_color = Color(1.0, 0.85, 0.55, 0.7)
	m.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
	mi.material_override = m
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(mi)
	mi.global_position = pos
	mi.scale = Vector3(0.3, 0.3, 0.3)
	var tw := mi.create_tween().set_parallel(true)
	tw.tween_property(mi, "scale", Vector3(radius, 0.6, radius), 0.35).set_ease(Tween.EASE_OUT).set_trans(Tween.TRANS_CUBIC)
	tw.tween_property(m, "albedo_color:a", 0.0, 0.45)
	tw.chain().tween_callback(mi.queue_free)


func add_shake(pos: Vector3, amount: float) -> void:
	if Game.player and is_instance_valid(Game.player):
		var d: float = Game.player.global_position.distance_to(pos)
		shake = max(shake, amount * clamp(1.0 - d / 30.0, 0.0, 1.0))


func attach_fire(target: Node3D) -> Node3D:
	var p := CPUParticles3D.new()
	p.amount = 18
	p.lifetime = 0.6
	p.emission_shape = CPUParticles3D.EMISSION_SHAPE_BOX
	p.emission_box_extents = Vector3(0.25, 0.8, 0.25)
	p.direction = Vector3.UP
	p.spread = 10.0
	p.gravity = Vector3(0, 3.0, 0)
	p.initial_velocity_min = 0.5
	p.initial_velocity_max = 1.5
	var m := QuadMesh.new()
	m.size = Vector2(0.3, 0.3)
	var mat := Mats.emissive(Color(1.0, 0.5, 0.1), 4.0).duplicate()
	mat.billboard_mode = BaseMaterial3D.BILLBOARD_ENABLED
	m.material = mat
	p.mesh = m
	p.position.y = 0.9
	target.add_child(p)
	return p


## Bile splash: survivors within radius are covered in bile.
func bile_burst(pos: Vector3, radius: float) -> void:
	var p := _make_burst(Color(0.45, 0.6, 0.15), 0.12, 6.0, 9.0)
	p.amount = 40
	p.global_position = pos + Vector3(0, 1, 0)
	p.restart()
	p.emitting = true
	Effects.after(p, 1.5, p.queue_free)
	for s in Game.survivors:
		if is_instance_valid(s) and not s.dead and s.global_position.distance_to(pos) < radius:
			s.apply_bile(15.0)
