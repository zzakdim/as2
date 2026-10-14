class_name Boomer
extends SpecialInfected
## Slow and fragile. Vomits bile that calls the horde onto whoever it hits,
## and bursts when killed, so shove it away before you shoot it.

var phase := "stalk"
var phase_t := 0.0


func _ready() -> void:
	kind = "boomer"
	max_hp = 50.0
	hp = max_hp
	run_speed = 4.2
	tell_sound = "boomer_gurgle"
	rig = SkinnedRig.create("minion", {"tint": Color(1.0, 0.92, 0.55), "scale": 1.12, "human": "peasant_m",
		"bone_scale": {"spine": Vector3(1.55, 1.1, 1.6), "chest": Vector3(1.0, 1.0, 0.95), "head": 0.75, "upperarm.l": 0.85, "upperarm.r": 0.85}})
	super._ready()


func collision_radius() -> float:
	return 0.5


func special_think() -> void:
	if phase == "retreat":
		var t0 = Game.nearest_survivor(global_position)
		if t0:
			var away: Vector3 = global_position - t0.global_position
			away.y = 0
			desired = away.normalized() * run_speed
		return
	var t = pick_target()
	if t == null:
		desired = Vector3.ZERO
		return
	var d: float = t.global_position.distance_to(global_position)
	var vis: bool = d < 20.0 and Game.level.los(global_position, t.global_position)
	if vis and d < 4.5 and ability_cd <= 0.0:
		_vomit(t)
		return
	rig.set_pose("zombie")
	steer_to(t.global_position, run_speed, vis and d < 12.0)


func special_physics(delta: float) -> void:
	if phase == "retreat":
		phase_t -= delta
		if phase_t <= 0.0:
			phase = "stalk"


func _vomit(t) -> void:
	ability_cd = 20.0
	phase = "retreat"
	phase_t = 3.0
	var dir: Vector3 = t.global_position - global_position
	dir.y = 0
	dir = dir.normalized()
	face_dir = dir
	Game.sfx.play3d("boomer_vomit", global_position + Vector3(0, 1.4, 0), 4.0, 0.05)
	var p := CPUParticles3D.new()
	p.one_shot = true
	p.explosiveness = 0.3
	p.amount = 40
	p.lifetime = 0.8
	p.direction = Vector3(0, 0.2, -1)
	p.spread = 15.0
	p.initial_velocity_min = 5.0
	p.initial_velocity_max = 8.0
	p.gravity = Vector3(0, -9, 0)
	var m := BoxMesh.new()
	m.size = Vector3(0.08, 0.08, 0.08)
	m.material = Mats.color(Color(0.45, 0.55, 0.12), 0.2)
	p.mesh = m
	rig.add_child(p)
	p.position = Vector3(0, 1.5, -0.3)
	p.emitting = true
	Effects.after(p, 1.5, p.queue_free)
	for s in Game.survivors:
		if not is_instance_valid(s) or s.dead:
			continue
		var to: Vector3 = s.global_position - global_position
		to.y = 0
		if to.length() < 5.5 and dir.dot(to.normalized()) > 0.6:
			s.apply_bile(15.0)


func on_death() -> void:
	Game.sfx.play3d("boomer_explode", global_position + Vector3(0, 1, 0), 4.0)
	Game.fx.bile_burst(global_position, 3.5)
	Game.fx.add_shake(global_position, 0.4)
	for s in Game.survivors:
		if is_instance_valid(s) and not s.dead:
			var d: float = s.global_position.distance_to(global_position)
			if d < 3.5:
				var away: Vector3 = s.global_position - global_position
				away.y = 0
				s.knockback(away.normalized() * 4.0 + Vector3(0, 2, 0), 0.6)
	rig.visible = false
