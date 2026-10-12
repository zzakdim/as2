class_name Witch
extends SpecialInfected
## Sits and sobs. Get close, shine your flashlight on her or make noise and
## she gets angrier, until she screams and runs down whoever set her off.

var phase := "idle"
var phase_t := 0.0
var anger := 0.0
var cry: AudioStreamPlayer3D
var anger_by := {}
var slash_cd := 0.0


func _ready() -> void:
	kind = "witch"
	max_hp = 1000.0
	hp = max_hp
	run_speed = 9.0
	can_be_shoved = false
	head_y = 0.85
	sitting = true
	rig = SkinnedRig.create("rogue", {"tint": Color(1.35, 1.35, 1.4), "glow_eyes": Color(1.0, 0.15, 0.1, 1.0)})
	super._ready()
	rig.set_pose("sit")
	cry = Game.sfx.start_loop("witch_cry", self, -2.0)
	cry.position.y = 1.0


func hit_part(p: Vector3) -> String:
	if phase == "idle" or phase == "agitated":
		var ly := p.y - global_position.y
		return "head" if ly > 0.8 else "body"
	head_y = 1.5
	return super.hit_part(p)


func part_mult(part: String) -> float:
	return 1.5 if part == "head" else 1.0


func shoved_off(_by) -> void:
	pass


func special_think() -> void:
	if phase == "idle" or phase == "agitated":
		desired = Vector3.ZERO
		return
	if phase == "rage":
		if target == null or not is_instance_valid(target) or target.dead:
			_leave()
			return
		var vis: bool = Game.level.los(global_position, target.global_position)
		var to: Vector3 = target.global_position - global_position
		to.y = 0
		if to.length() < 1.3:
			desired = Vector3.ZERO
		else:
			steer_to(target.global_position, run_speed, vis)


func special_physics(delta: float) -> void:
	match phase:
		"idle", "agitated":
			_update_anger(delta)
		"startle":
			desired = Vector3.ZERO
			phase_t -= delta
			if target and is_instance_valid(target):
				var to: Vector3 = target.global_position - global_position
				to.y = 0
				face_dir = to.normalized()
			if phase_t <= 0.0:
				phase = "rage"
				rig.set_pose("zombie")
		"rage":
			slash_cd -= delta
			if target and is_instance_valid(target) and not target.dead:
				if target.global_position.distance_to(global_position) < 1.5 and slash_cd <= 0.0:
					slash_cd = 1.0
					rig.swing(0.3)
					Game.sfx.play3d("claw", target.global_position + Vector3(0, 1, 0), 4.0)
					if not target.incapped:
						if Game.difficulty == Game.Diff.EXPERT:
							target.take_damage(1000.0, self, "incap")
							target.die()
						else:
							target.take_damage(1000.0, self, "incap")
					else:
						target.take_damage(25.0 * Game.special_damage_mult(), self, "claw")
		"leave":
			phase_t -= delta
			if phase_t <= 0.0:
				queue_free()


func _update_anger(delta: float) -> void:
	var top = null
	var top_v := 0.0
	for s in Game.survivors:
		if not is_instance_valid(s) or s.dead:
			continue
		var d: float = s.global_position.distance_to(global_position)
		var a := 0.0
		if d < 11.0:
			a += (11.0 - d) / 11.0 * 0.45
			if s.flashlight_on():
				var to: Vector3 = (global_position + Vector3(0, 0.6, 0)) - s.eye_pos()
				if s.aim_dir().dot(to.normalized()) > 0.95:
					a += 0.5
			if s.want_crouch or s.want_walk:
				a *= 0.5
		anger += a * delta
		anger_by[s] = anger_by.get(s, 0.0) + a * delta
		if anger_by[s] > top_v:
			top_v = anger_by[s]
			top = s
	anger = max(0.0, anger - 0.08 * delta)
	phase = "agitated" if anger > 0.35 else "idle"
	if cry:
		cry.volume_db = lerp(-2.0, 6.0, clamp(anger, 0.0, 1.0))
		cry.pitch_scale = lerp(1.0, 1.25, clamp(anger, 0.0, 1.0))
	if anger >= 1.0 and top:
		_startle(top)


func hear_noise(pos: Vector3) -> void:
	if phase == "idle" or phase == "agitated":
		if pos.distance_to(global_position) < 12.0:
			anger += 0.2


func on_hurt(attacker, _dmg: float, _t: String) -> void:
	if (phase == "idle" or phase == "agitated") and attacker and is_instance_valid(attacker) and attacker is Survivor:
		_startle(attacker)


func _startle(s) -> void:
	phase = "startle"
	phase_t = 1.0
	target = s
	sitting = false
	if cry:
		cry.queue_free()
		cry = null
	Game.sfx.play3d("witch_scream", global_position + Vector3(0, 1, 0), 10.0, 0.0)
	Game.callout(s, "WITCH! RUN!")
	rig.set_pose("idle")
	head_y = 1.5
	if Game.director:
		Game.director.add_intensity(s, 0.8)


func _leave() -> void:
	phase = "leave"
	phase_t = 6.0
	desired = Vector3.ZERO
	rig.set_pose("sit")
