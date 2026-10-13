class_name Tank
extends SpecialInfected
## Boss infected. Huge health pool, punches survivors across the street and
## throws chunks of concrete. Its arrival changes the music.

var phase := "chase"
var phase_t := 0.0
var punch_cd := 0.0
var rock_cd := 6.0
var punch_pending := 0.0
var rock_target = null


func _ready() -> void:
	kind = "tank"
	max_hp = Game.tank_hp()
	hp = max_hp
	run_speed = 5.6
	accel = 12.0
	can_be_shoved = false
	head_y = 2.35
	leg_y = 0.9
	tell_sound = ""
	rig = SkinnedRig.create("warrior", {"tint": Color(0.7, 0.78, 0.62), "scale": 1.5, "role": "boss", "glow_eyes": Color(1.0, 0.3, 0.1, 1.0),
		"bone_scale": {"chest": 1.3, "upperarm.l": 1.4, "upperarm.r": 1.4, "hand.l": 1.3, "hand.r": 1.3, "head": 0.55}})
	super._ready()
	Game.sfx.play3d("tank_roar", global_position + Vector3(0, 2, 0), 8.0, 0.0)


func collision_radius() -> float:
	return 0.65

func collision_height() -> float:
	return 2.4


func part_mult(part: String) -> float:
	return 1.0 if part != "leg" else 0.85


func shoved_off(_by) -> void:
	pass


func special_think() -> void:
	if phase != "chase":
		return
	var t = null
	var bd := INF
	for s in Game.survivors:
		if not is_instance_valid(s) or s.dead:
			continue
		var d: float = s.global_position.distance_to(global_position)
		if s.incapped:
			d += 8.0  # prefer survivors still standing
		if d < bd:
			bd = d
			t = s
	if t == null:
		desired = Vector3.ZERO
		return
	target = t
	var dist: float = t.global_position.distance_to(global_position)
	var vis: bool = Game.level.los(global_position, t.global_position)
	rig.set_pose("zombie")
	if dist < 2.4 and punch_cd <= 0.0:
		punch_cd = 1.5
		punch_pending = 0.3
		rig.swing(0.55)
		desired = Vector3.ZERO
		return
	if vis and dist > 9.0 and dist < 35.0 and rock_cd <= 0.0:
		phase = "rock"
		phase_t = 1.2
		rock_target = t
		desired = Vector3.ZERO
		rig.swing(1.2)
		return
	steer_to(t.global_position, run_speed, vis and dist < 15.0)
	if randf() < 0.05:
		Game.sfx.play3d("tank_roar", global_position + Vector3(0, 2, 0), 2.0, 0.1)


func special_physics(delta: float) -> void:
	punch_cd = max(0.0, punch_cd - delta)
	rock_cd = max(0.0, rock_cd - delta)
	if punch_pending > 0.0:
		punch_pending -= delta
		if punch_pending <= 0.0:
			_punch()
	if phase == "rock":
		desired = Vector3.ZERO
		phase_t -= delta
		if rock_target and is_instance_valid(rock_target):
			var to: Vector3 = rock_target.global_position - global_position
			to.y = 0
			face_dir = to.normalized()
		if phase_t <= 0.0:
			phase = "chase"
			rock_cd = randf_range(7.0, 10.0)
			if rock_target and is_instance_valid(rock_target):
				var p := Projectile.new()
				p.kind = "rock"
				p.owner_inf = self
				Game.world.add_child(p)
				p.global_position = global_position + Vector3(0, 3.0, 0)
				var dist: float = rock_target.global_position.distance_to(global_position)
				p.launch_to(rock_target.global_position + rock_target.velocity * (dist / 22.0) + Vector3(0, 1.0, 0), max(0.5, dist / 22.0))


func _punch() -> void:
	var fwd := face_dir
	var hit := false
	for s in Game.survivors:
		if not is_instance_valid(s) or s.dead:
			continue
		var to: Vector3 = s.global_position - global_position
		to.y = 0
		var d := to.length()
		if d < 2.8 and (d < 0.5 or fwd.dot(to / d) > 0.3):
			hit = true
			s.take_damage(24.0 * Game.special_damage_mult(), self, "punch")
			if not s.incapped and not s.dead:
				s.knockback((to / max(d, 0.1)) * 11.0 + Vector3(0, 5.0, 0), 1.4)
	if hit:
		Game.sfx.play3d("tank_punch", global_position + Vector3(0, 1.5, 0), 6.0)
		Game.fx.add_shake(global_position, 0.8)


func on_death() -> void:
	Game.sfx.play3d("tank_roar", global_position + Vector3(0, 2, 0), 4.0, 0.0)
	if Game.director:
		Game.director.on_tank_dead()
