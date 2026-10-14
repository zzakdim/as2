class_name Hunter
extends SpecialInfected
## Stalks, crouches with a screech, then pounces and pins a survivor.
## Shove or kill it to free them. Shove it mid-air to "skeet" it.

var phase := "stalk"
var phase_t := 0.0
var leap_target = null


func _ready() -> void:
	kind = "hunter"
	max_hp = 250.0
	hp = max_hp
	run_speed = 6.6
	pin_damage = 10.0
	tell_sound = "hunter_growl"
	rig = SkinnedRig.create("rogue", {"tint": Color(0.55, 0.65, 1.0), "glow_eyes": Color(0.4, 0.6, 1.0, 1.0), "human": "ranger_m", "hood": true})
	super._ready()


func special_think() -> void:
	if phase != "stalk":
		return
	var t = pick_target()
	if t == null:
		desired = Vector3.ZERO
		return
	var d: float = t.global_position.distance_to(global_position)
	var vis: bool = d < 28.0 and Game.level.los(global_position, t.global_position)
	if vis and d < 22.0 and d > 2.0 and ability_cd <= 0.0:
		phase = "crouch"
		phase_t = 0.7
		leap_target = t
		desired = Vector3.ZERO
		rig.set_pose("crouch")
		Game.sfx.play3d("hunter_screech", global_position + Vector3(0, 1, 0), 2.0, 0.05)
		return
	rig.set_pose("crouch" if vis and d < 30.0 else "zombie")
	steer_to(t.global_position, run_speed * (0.6 if vis else 1.0), vis and d < 12.0)


func special_physics(delta: float) -> void:
	match phase:
		"crouch":
			desired = Vector3.ZERO
			phase_t -= delta
			if leap_target and is_instance_valid(leap_target):
				var to: Vector3 = leap_target.global_position - global_position
				to.y = 0
				if to.length_squared() > 0.01:
					face_dir = to.normalized()
			if phase_t <= 0.0:
				_launch()
		"leap":
			phase_t += delta
			desired = Vector3(velocity.x, 0, velocity.z)
			for s in Game.survivors:
				if not is_instance_valid(s) or s.dead or s.pinned_by != null:
					continue
				if s.global_position.distance_to(global_position) < 1.4:
					_land_on(s)
					return
			if phase_t > 0.25 and is_on_floor():
				phase = "stalk"
				ability_cd = 1.5
				rig.set_pose("zombie")
		"pinning":
			desired = Vector3.ZERO
			velocity = Vector3.ZERO
			if victim == null or not is_instance_valid(victim):
				_end_pin()
				return
			global_position = global_position.lerp(victim.global_position + face_dir * 0.4, min(1.0, delta * 10.0))
			if randf() < delta * 5.0:
				rig.swing(0.2)
			damage_victim(delta)


func _launch() -> void:
	if leap_target == null or not is_instance_valid(leap_target):
		phase = "stalk"
		return
	var to: Vector3 = leap_target.global_position + leap_target.velocity * 0.3 - global_position
	to.y = 0
	var dist := to.length()
	var flat: Vector3 = to / max(dist, 0.01)
	var speed: float = clamp(dist * 1.1, 8.0, 15.0)
	velocity = flat * speed + Vector3(0, clampf(0.5 * _grav * dist / speed, 3.0, 11.0), 0)
	desired = flat * speed
	phase = "leap"
	phase_t = 0.0
	jump_lock = 0.2
	face_dir = flat


func _land_on(s) -> void:
	phase = "pinning"
	collision_mask = Game.LAYER_WORLD
	s.take_damage(5.0 * Game.special_damage_mult(), self, "pounce")
	if s.dead:
		_end_pin()
		return
	pin_victim(s, "hunter")
	rig.set_pose("crouch")


func _end_pin() -> void:
	phase = "stalk"
	ability_cd = 2.0
	collision_mask = Game.LAYER_WORLD | Game.LAYER_SURVIVOR | Game.LAYER_INFECTED
	rig.set_pose("zombie")


func release_pin() -> void:
	super.release_pin()
	if state != S.DEAD:
		_end_pin()


func shove(from: Vector3, by) -> void:
	if phase == "leap":
		phase = "stalk"
		ability_cd = 2.0
		if by and is_instance_valid(by):
			Game.callout(by, "Skeeted!")
	super.shove(from, by)
