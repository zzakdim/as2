class_name Hazard
extends Node3D
## Ground-area effects: molotov fire, spitter acid, bile clouds (attractors).

var kind := "fire"
var radius := 4.0
var life := 15.0
var owner_s = null
var tick := 0.0
var age := 0.0
var _light: OmniLight3D
var _particles: CPUParticles3D


static func spawn_fire(p: Vector3, r: float, life_s: float, by) -> Hazard:
	var h := Hazard.new()
	h.kind = "fire"
	h.radius = r
	h.life = life_s
	h.owner_s = by
	Game.world.add_child(h)
	h.global_position = p
	return h


static func spawn_acid(p: Vector3, r: float, life_s: float) -> Hazard:
	var h := Hazard.new()
	h.kind = "acid"
	h.radius = r
	h.life = life_s
	Game.world.add_child(h)
	h.global_position = p
	return h


static func spawn_bile_cloud(p: Vector3, life_s: float) -> Hazard:
	var h := Hazard.new()
	h.kind = "bile"
	h.radius = 35.0
	h.life = life_s
	Game.world.add_child(h)
	h.global_position = p
	Game.attractors.append(h)
	return h


func _ready() -> void:
	Game.hazards.append(self)
	var col := Color(1.0, 0.45, 0.1)
	var vis_r := radius
	match kind:
		"acid":
			col = Color(0.4, 1.0, 0.2)
		"bile":
			col = Color(0.5, 0.7, 0.2)
			vis_r = 2.0
	var disc := MeshInstance3D.new()
	var cm := CylinderMesh.new()
	cm.top_radius = vis_r
	cm.bottom_radius = vis_r
	cm.height = 0.02
	disc.mesh = cm
	disc.material_override = Mats.emissive(col.darkened(0.4), 1.5)
	disc.position.y = 0.02
	add_child(disc)
	_particles = CPUParticles3D.new()
	_particles.amount = 60 if kind == "fire" else 25
	_particles.lifetime = 0.9
	_particles.emission_shape = CPUParticles3D.EMISSION_SHAPE_SPHERE
	_particles.emission_sphere_radius = vis_r * 0.8
	_particles.direction = Vector3.UP
	_particles.spread = 15.0
	_particles.gravity = Vector3(0, 2.0 if kind == "fire" else 0.5, 0)
	_particles.initial_velocity_min = 0.5
	_particles.initial_velocity_max = 2.0
	_particles.scale_amount_min = 0.3
	_particles.scale_amount_max = 0.8
	var pm := QuadMesh.new()
	pm.size = Vector2(0.5, 0.5)
	var mat := Mats.emissive(col, 3.0).duplicate()
	mat.billboard_mode = BaseMaterial3D.BILLBOARD_ENABLED
	mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	mat.albedo_color.a = 0.7
	pm.material = mat
	_particles.mesh = pm
	var grad := Gradient.new()
	grad.set_color(0, Color(1, 1, 1, 1))
	grad.set_color(1, Color(1, 1, 1, 0))
	_particles.color_ramp = grad
	_particles.position.y = 0.2
	add_child(_particles)
	_light = OmniLight3D.new()
	_light.light_color = col
	_light.light_energy = 2.5 if kind == "fire" else 1.0
	_light.omni_range = radius * 2.5
	_light.position.y = 1.0
	add_child(_light)
	if kind == "fire":
		Game.sfx.start_loop("fire", self, 0.0)


func _exit_tree() -> void:
	Game.hazards.erase(self)
	Game.attractors.erase(self)


func _physics_process(delta: float) -> void:
	age += delta
	life -= delta
	if kind == "fire":
		_light.light_energy = 2.0 + randf() * 1.2
	if life <= 0.0:
		queue_free()
		return
	if life < 1.0:
		_particles.emitting = false
	tick -= delta
	if tick > 0.0:
		return
	tick = 0.25
	var r2 := radius * radius
	match kind:
		"fire":
			for z in Game.infected.duplicate():
				if is_instance_valid(z) and not z.is_dead() and _flat_d2(z.global_position) < r2:
					z.ignite(owner_s)
			for s in Game.survivors:
				if is_instance_valid(s) and not s.dead and _flat_d2(s.global_position) < r2:
					s.take_damage(1.5 * (1.0 + Game.difficulty), owner_s, "fire")
		"acid":
			# Spitter acid ramps up the longer it has been down.
			var dps: float = lerp(2.0, 12.0, clamp(age / 3.0, 0.0, 1.0)) * Game.special_damage_mult()
			for s in Game.survivors:
				if is_instance_valid(s) and not s.dead and _flat_d2(s.global_position) < r2:
					s.take_damage(dps * 0.25, null, "acid")


func _flat_d2(p: Vector3) -> float:
	var d := p - global_position
	return d.x * d.x + d.z * d.z
