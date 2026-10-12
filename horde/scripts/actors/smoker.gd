class_name Smoker
extends SpecialInfected
## Lashes a survivor with its tongue from range and drags them in to choke.
## Shoot the smoker, or shove the victim, to break the tongue.

var phase := "stalk"
var phase_t := 0.0
var tongue_target = null
var tongue: MeshInstance3D
var los_lost := 0.0


func _ready() -> void:
	kind = "smoker"
	max_hp = 250.0
	hp = max_hp
	run_speed = 4.8
	pin_damage = 5.0
	tell_sound = "smoker_cough"
	rig = BodyRig.make({
		"skin": Color(0.42, 0.45, 0.32), "shirt": Color(0.3, 0.28, 0.22), "pants": Color(0.2, 0.2, 0.2),
		"scale": 1.12, "torso": Vector3(0.4, 0.7, 0.24), "leg_len": 0.95, "arm_len": 0.8, "hunch": 0.2,
	})
	super._ready()
	tongue = MeshInstance3D.new()
	var cm := CylinderMesh.new()
	cm.top_radius = 0.03
	cm.bottom_radius = 0.03
	cm.height = 1.0
	cm.radial_segments = 5
	tongue.mesh = cm
	tongue.material_override = Mats.color(Color(0.5, 0.15, 0.15), 0.4)
	tongue.visible = false
	tongue.top_level = true
	add_child(tongue)


func special_think() -> void:
	if phase != "stalk":
		return
	var t = pick_target()
	if t == null:
		desired = Vector3.ZERO
		return
	var d: float = t.global_position.distance_to(global_position)
	var vis: bool = d < 32.0 and Game.level.los(global_position, t.global_position)
	if vis and d < 28.0 and d > 3.0 and ability_cd <= 0.0:
		phase = "shoot"
		phase_t = d / 45.0 + 0.25
		tongue_target = t
		desired = Vector3.ZERO
		Game.sfx.play3d("smoker_tongue", global_position + Vector3(0, 1.6, 0), 2.0, 0.05)
		return
	rig.set_pose("zombie")
	if vis and d < 22.0:
		desired = Vector3.ZERO  # hold position and wait for the cooldown
	else:
		steer_to(t.global_position, run_speed, false)


func special_physics(delta: float) -> void:
	match phase:
		"shoot":
			desired = Vector3.ZERO
			phase_t -= delta
			if phase_t <= 0.0:
				var t = tongue_target
				if t and is_instance_valid(t) and not t.dead and t.pinned_by == null and Game.level.los(global_position, t.global_position):
					pin_victim(t, "smoker")
					phase = "drag"
					los_lost = 0.0
					collision_mask = Game.LAYER_WORLD | Game.LAYER_INFECTED
				else:
					phase = "stalk"
					ability_cd = 4.0
		"drag", "choke":
			desired = Vector3.ZERO
			if victim == null or not is_instance_valid(victim):
				release_pin()
				return
			var to: Vector3 = global_position - victim.global_position
			to.y = 0
			var d := to.length()
			face_dir = -to.normalized() if d > 0.01 else face_dir
			if not Game.level.los(global_position, victim.global_position):
				los_lost += delta
				if los_lost > 0.6:
					release_pin()
					return
			else:
				los_lost = 0.0
			if d > 1.3:
				phase = "drag"
				victim.move_and_collide(to / d * 2.6 * delta)
				if randf() < delta:
					victim.take_damage(2.0 * Game.special_damage_mult(), self, "pin")
			else:
				phase = "choke"
				damage_victim(delta)
	_update_tongue()


func _update_tongue() -> void:
	var show := (phase == "drag" or phase == "choke") and victim != null and is_instance_valid(victim)
	tongue.visible = show
	if not show:
		return
	var a := global_position + Vector3(0, 1.75, 0)
	var b: Vector3 = victim.global_position + Vector3(0, 1.0, 0)
	var len := a.distance_to(b)
	if len < 0.05:
		tongue.visible = false
		return
	tongue.global_position = (a + b) * 0.5
	var up := (b - a) / len
	var side := up.cross(Vector3.FORWARD if abs(up.dot(Vector3.FORWARD)) < 0.9 else Vector3.RIGHT).normalized()
	var fwd := side.cross(up)
	tongue.global_basis = Basis(side, up * len, fwd)


func release_pin() -> void:
	super.release_pin()
	phase = "stalk"
	ability_cd = 8.0
	collision_mask = Game.LAYER_WORLD | Game.LAYER_SURVIVOR | Game.LAYER_INFECTED
	if tongue:
		tongue.visible = false


func on_death() -> void:
	# Smoke cloud
	var p := CPUParticles3D.new()
	p.one_shot = true
	p.explosiveness = 0.9
	p.amount = 30
	p.lifetime = 3.0
	p.emission_shape = CPUParticles3D.EMISSION_SHAPE_SPHERE
	p.emission_sphere_radius = 1.0
	p.gravity = Vector3(0, 0.3, 0)
	p.initial_velocity_max = 1.0
	p.scale_amount_min = 2.0
	p.scale_amount_max = 4.0
	var m := QuadMesh.new()
	m.size = Vector2(0.6, 0.6)
	var mat := Mats.unshaded(Color(0.45, 0.5, 0.4, 0.25), true).duplicate()
	mat.billboard_mode = BaseMaterial3D.BILLBOARD_ENABLED
	m.material = mat
	p.mesh = m
	Game.world.add_child(p)
	p.global_position = global_position + Vector3(0, 1.2, 0)
	p.emitting = true
	Effects.after(p, 4.0, p.queue_free)
	Game.sfx.play3d("smoker_cough", global_position, 0.0)
