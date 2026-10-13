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
	p.scale_amount_min = 0.5
	p.scale_amount_max = 1.3
	if emissive:
		var m := BoxMesh.new()
		m.size = Vector3(size, size, size)
		m.material = Mats.emissive(col, 2.0)
		p.mesh = m
	else:
		# Droplets stretched along their velocity, shrinking as they fly.
		var m := SphereMesh.new()
		m.radius = size * 0.3
		m.height = size * 2.4
		m.radial_segments = 5
		m.rings = 2
		m.material = blood_mat()
		p.mesh = m
		p.particle_flag_align_y = true
		var c := Curve.new()
		c.add_point(Vector2(0, 1))
		c.add_point(Vector2(0.7, 0.75))
		c.add_point(Vector2(1, 0.0))
		p.scale_amount_curve = c
	add_child(p)
	return p


static var _blood_mat: StandardMaterial3D

static func blood_mat() -> StandardMaterial3D:
	if _blood_mat == null:
		_blood_mat = StandardMaterial3D.new()
		_blood_mat.albedo_color = Color(0.26, 0.012, 0.01)
		_blood_mat.roughness = 0.15
		_blood_mat.metallic_specular = 0.9
		# Droplets right in front of the lens would read as big red shards.
		_blood_mat.distance_fade_mode = BaseMaterial3D.DISTANCE_FADE_PIXEL_DITHER
		_blood_mat.distance_fade_min_distance = 0.5
		_blood_mat.distance_fade_max_distance = 1.3
	return _blood_mat


static var _mist_tex: Texture2D

## A soft red cloud, for the spray of a big cut.
func blood_mist(pos: Vector3, dir: Vector3, size := 0.6) -> void:
	if _mist_tex == null:
		var g := Gradient.new()
		g.set_color(0, Color(1, 1, 1, 1))
		g.set_color(1, Color(1, 1, 1, 0))
		var gt := GradientTexture2D.new()
		gt.gradient = g
		gt.fill = GradientTexture2D.FILL_RADIAL
		gt.fill_from = Vector2(0.5, 0.5)
		gt.fill_to = Vector2(0.5, 0.0)
		gt.width = 64
		gt.height = 64
		_mist_tex = gt
	var p := CPUParticles3D.new()
	p.one_shot = true
	p.explosiveness = 0.9
	p.amount = 6
	p.lifetime = 0.7
	p.local_coords = false
	p.direction = dir.normalized() if dir.length_squared() > 0.01 else Vector3.UP
	p.spread = 40.0
	p.initial_velocity_min = 0.6
	p.initial_velocity_max = 2.2
	p.damping_min = 2.0
	p.damping_max = 3.0
	p.gravity = Vector3(0, -1.2, 0)
	var c := Curve.new()
	c.add_point(Vector2(0, 0.4))
	c.add_point(Vector2(1, 1.0))
	p.scale_amount_curve = c
	p.scale_amount_min = size * 0.6
	p.scale_amount_max = size
	var g2 := Gradient.new()
	g2.set_color(0, Color(0.45, 0.02, 0.02, 0.55))
	g2.set_color(1, Color(0.3, 0.01, 0.01, 0.0))
	p.color_ramp = g2
	var q := QuadMesh.new()
	q.size = Vector2.ONE
	var m := StandardMaterial3D.new()
	m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	m.billboard_mode = BaseMaterial3D.BILLBOARD_PARTICLES
	m.vertex_color_use_as_albedo = true
	m.albedo_texture = _mist_tex
	q.material = m
	p.mesh = q
	p.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(p)
	p.global_position = pos
	p.emitting = true
	Effects.after(p, 1.2, p.queue_free)


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


var _drip_pool: Array = []
var _drip_i := 0

## One drop falling from a bloody blade.
func drip(pos: Vector3) -> void:
	if _drip_pool.is_empty():
		for i in 8:
			var p := CPUParticles3D.new()
			p.one_shot = true
			p.emitting = false
			p.amount = 2
			p.lifetime = 0.7
			p.explosiveness = 0.6
			p.local_coords = false
			p.direction = Vector3.DOWN
			p.spread = 8.0
			p.initial_velocity_min = 0.1
			p.initial_velocity_max = 0.4
			p.gravity = Vector3(0, -9.8, 0)
			var m := SphereMesh.new()
			m.radius = 0.005
			m.height = 0.022
			m.radial_segments = 4
			m.rings = 2
			m.material = blood_mat()
			p.mesh = m
			p.particle_flag_align_y = true
			add_child(p)
			_drip_pool.append(p)
	var d: CPUParticles3D = _drip_pool[_drip_i]
	_drip_i = (_drip_i + 1) % _drip_pool.size()
	d.global_position = pos
	d.restart()
	d.emitting = true


static var _slash_mat: StandardMaterial3D

## A thin bright streak at the point of contact, along the blade's travel,
## gone in a few frames: makes each connect read crisply.
func slash_mark(pos: Vector3, tangent: Vector3, length := 0.5, heavy := false) -> void:
	if _slash_mat == null:
		_slash_mat = StandardMaterial3D.new()
		_slash_mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		_slash_mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		_slash_mat.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
		_slash_mat.albedo_color = Color(1.0, 0.75, 0.6, 0.9)
		_slash_mat.cull_mode = BaseMaterial3D.CULL_DISABLED
	var mi := MeshInstance3D.new()
	var q := QuadMesh.new()
	q.size = Vector2(length * (1.4 if heavy else 1.0), 0.035 if heavy else 0.022)
	mi.mesh = q
	mi.material_override = _slash_mat
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(mi)
	var t := tangent.normalized()
	var cam := get_viewport().get_camera_3d()
	var to_cam: Vector3 = (cam.global_position - pos).normalized() if cam else Vector3.UP
	var up := to_cam.cross(t).normalized()
	if up.length_squared() < 0.01:
		up = Vector3.UP
	mi.global_transform = Transform3D(Basis(t, up, t.cross(up)), pos + to_cam * 0.05)
	var tw := mi.create_tween()
	tw.tween_property(mi, "scale", Vector3(1.6, 0.2, 1.0), 0.09)
	tw.tween_callback(mi.queue_free)


## Chunks + mist for a split head or a body cut in half.
func gib_burst(pos: Vector3, dir: Vector3, size: float) -> void:
	var p := CPUParticles3D.new()
	p.one_shot = true
	p.explosiveness = 0.95
	p.amount = 8
	p.lifetime = 1.4
	p.local_coords = false
	p.direction = (dir + Vector3(0, 0.6, 0)).normalized()
	p.spread = 55.0
	p.initial_velocity_min = 2.0
	p.initial_velocity_max = 5.5
	p.gravity = Vector3(0, -14, 0)
	p.angular_velocity_min = -500
	p.angular_velocity_max = 500
	p.scale_amount_min = 0.5
	p.scale_amount_max = 1.2
	var m := SphereMesh.new()
	m.radius = clampf(size * 0.12, 0.012, 0.035)
	m.height = m.radius * 1.4
	m.radial_segments = 5
	m.rings = 3
	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color(0.3, 0.04, 0.04)
	mat.roughness = 0.3
	m.material = mat
	p.mesh = m
	add_child(p)
	p.global_position = pos
	p.emitting = true
	Effects.after(p, 1.6, p.queue_free)
	blood_spray(pos, dir + Vector3(0, 0.5, 0), 26)
	blood_mist(pos, dir, 0.4 + size)


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
	var m := SphereMesh.new()
	m.radius = 0.011
	m.height = 0.05
	m.radial_segments = 5
	m.rings = 2
	m.material = blood_mat()
	p.mesh = m
	p.particle_flag_align_y = true
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
		d.cull_mask = 1
		add_child(d)
	d.texture_albedo = Mats.floor_blood(randi() % 4)
	var s := randf_range(1.0, 1.8)
	d.size = Vector3(s, 1.0, s)
	d.global_position = Vector3(pos.x, 0.3, pos.z)
	d.rotation.y = randf() * TAU
	_decals.append(d)


## A pool spreading out from under a body over a few seconds.
func blood_pool(node: Node3D) -> void:
	var d: Decal
	if _decals.size() >= MAX_DECALS:
		d = _decals.pop_front()
	else:
		d = Decal.new()
		d.cull_mask = 1
		add_child(d)
	_decals.append(d)
	d.texture_albedo = Mats.floor_blood(randi() % 4)
	d.size = Vector3(0.2, 1.0, 0.2)
	var p := node.global_position
	d.global_position = Vector3(p.x, p.y + 0.3, p.z)
	d.rotation.y = randf() * TAU
	var full := randf_range(1.3, 2.0)
	var tw := d.create_tween()
	tw.tween_property(d, "size", Vector3(full, 1.0, full), randf_range(4.0, 7.0)).set_ease(Tween.EASE_OUT).set_trans(Tween.TRANS_CUBIC)


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
		add_child(dc)
	dc.texture_albedo = Mats.floor_blood(randi() % 4)
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
