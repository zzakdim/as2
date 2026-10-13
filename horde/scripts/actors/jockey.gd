class_name Jockey
extends SpecialInfected
## Small and fast. Leaps onto a survivor's shoulders and rides them, steering
## away from the team (and toward the horde) while clawing at their head.
## The victim can only slow it by pulling the other way; a teammate has to
## shove or shoot it off.

var phase := "stalk"
var phase_t := 0.0
var leap_target = null
var wobble := 0.0
var ride_dir := Vector3.FORWARD


func _ready() -> void:
	kind = "jockey"
	max_hp = 325.0
	hp = max_hp
	run_speed = 7.2
	pin_damage = 4.0
	tell_sound = "hunter_growl"
	rig = SkinnedRig.create("minion", {"tint": Color(0.85, 0.75, 0.6), "scale": 0.78, "glow_eyes": Color(1.0, 0.8, 0.2, 1.0)})
	super._ready()


func collision_radius() -> float:
	return 0.3


func special_think() -> void:
	if phase != "stalk":
		return
	var t = pick_target()
	if t == null:
		desired = Vector3.ZERO
		return
	var d: float = t.global_position.distance_to(global_position)
	var vis: bool = d < 25.0 and Game.level.los(global_position, t.global_position)
	if vis and d < 9.0 and d > 1.2 and ability_cd <= 0.0:
		_launch(t)
		return
	rig.set_pose("crouch" if vis and d < 14.0 else "zombie")
	# Zig-zag in, giggling, like the real thing.
	wobble += 0.7
	steer_to(t.global_position, run_speed, vis)
	if vis:
		desired += desired.cross(Vector3.UP).normalized() * sin(wobble) * 2.5


func _launch(t) -> void:
	leap_target = t
	var to: Vector3 = t.global_position + t.velocity * 0.25 - global_position
	to.y = 0.0
	var dist := to.length()
	var flat: Vector3 = to / maxf(dist, 0.01)
	var speed := clampf(dist * 1.5, 6.0, 11.0)
	# Ballistic: stay up long enough to cover the distance.
	velocity = flat * speed + Vector3(0, clampf(0.5 * _grav * dist / speed, 2.5, 9.0), 0)
	desired = Vector3(velocity.x, 0, velocity.z)
	face_dir = flat
	phase = "leap"
	phase_t = 0.0
	jump_lock = 0.2
	Game.sfx.play3d("hunter_screech", global_position + Vector3(0, 1, 0), 0.0, 0.2)


func special_physics(delta: float) -> void:
	match phase:
		"leap":
			phase_t += delta
			desired = Vector3(velocity.x, 0, velocity.z)
			for s in Game.survivors:
				if not is_instance_valid(s) or s.dead or s.incapped or s.pinned_by != null:
					continue
				if s.global_position.distance_to(global_position) < 1.3:
					_mount(s)
					return
			if phase_t > 0.25 and is_on_floor():
				phase = "stalk"
				ability_cd = 1.5
		"riding":
			if victim == null or not is_instance_valid(victim) or victim.dead or victim.incapped:
				release_pin()
				return
			desired = Vector3.ZERO
			velocity = Vector3.ZERO
			_steer_victim(delta)
			global_position = victim.global_position + Vector3(0, 1.05, 0) - ride_dir * 0.15
			face_dir = ride_dir
			if randf() < delta * 4.0:
				rig.swing(0.2)
			damage_victim(delta)


## Push the victim away from their friends and toward other infected,
## weaving; pulling against it (player input or a bot) slows the ride.
func _steer_victim(delta: float) -> void:
	var p: Vector3 = victim.global_position
	var away := Vector3.ZERO
	for o in Game.survivors:
		if o != victim and is_instance_valid(o) and not o.dead:
			var v: Vector3 = p - o.global_position
			v.y = 0.0
			away += v.normalized() / maxf(v.length(), 2.0)
	var lure := Vector3.ZERO
	for z in Game.infected:
		if z != self and is_instance_valid(z) and not z.is_dead():
			var v: Vector3 = z.global_position - p
			v.y = 0.0
			var l := v.length()
			if l < 20.0 and l > 1.0:
				lure += v / l * 0.15
	wobble += delta * 3.0
	var want: Vector3 = away * 3.0 + lure + ride_dir
	want.y = 0.0
	if want.length_squared() > 0.01:
		ride_dir = ride_dir.slerp(want.normalized(), minf(1.0, delta * 1.5)).normalized()
	var dir := ride_dir.rotated(Vector3.UP, sin(wobble) * 0.5)
	var speed := 3.0
	var resist: Vector3 = victim.move_dir if "move_dir" in victim else Vector3.ZERO
	if resist.length_squared() > 0.01 and resist.normalized().dot(dir) < -0.2:
		speed *= 0.45
	victim.ride_vel = dir * speed


func _mount(s) -> void:
	phase = "riding"
	collision_mask = 0
	collision_layer = Game.LAYER_INFECTED
	s.take_damage(3.0 * Game.special_damage_mult(), self, "pounce")
	if s.dead:
		_end_ride()
		return
	pin_victim(s, "jockey")
	ride_dir = face_dir if face_dir.length_squared() > 0.01 else Vector3.FORWARD
	s.add_collision_exception_with(self)
	rig.set_pose("crouch")
	Game.sfx.play3d("hunter_screech", global_position + Vector3(0, 1, 0), 4.0, 0.3)


func _end_ride() -> void:
	phase = "stalk"
	ability_cd = 3.0
	collision_mask = Game.LAYER_WORLD | Game.LAYER_SURVIVOR | Game.LAYER_INFECTED
	rig.set_pose("zombie")


func release_pin() -> void:
	if victim and is_instance_valid(victim):
		victim.ride_vel = Vector3.ZERO
		victim.remove_collision_exception_with(self)
	super.release_pin()
	if state != S.DEAD:
		_end_ride()
		global_position += Vector3(0, -0.9, 0)
