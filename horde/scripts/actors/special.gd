class_name SpecialInfected
extends Infected
## Shared behaviour for special infected: stalking, keeping out of sight until
## ready, pinning survivors, and audio tells.

var victim = null           # pinned survivor
var ability_cd := 0.0
var tell_t := 0.0
var tell_sound := ""
var preferred_range := 12.0
var pin_damage := 10.0      # per second while pinned (Normal)


func _ready() -> void:
	is_special = true
	state = S.SPECIAL
	super._ready()
	tell_t = randf_range(1.0, 4.0)


func _physics_process(delta: float) -> void:
	if state != S.DEAD:
		ability_cd = max(0.0, ability_cd - delta)
		tell_t -= delta
		if tell_t <= 0.0 and tell_sound != "":
			tell_t = randf_range(3.0, 6.0)
			Game.sfx.play3d(tell_sound, global_position + Vector3(0, 1.4, 0), 0.0, 0.1)
	super._physics_process(delta)


func think() -> void:
	if state == S.STAGGER:
		return
	special_think()


func special_think() -> void:
	pass


func _vocalize() -> void:
	pass


func alert(_by = null) -> void:
	pass


func hear_noise(_pos: Vector3) -> void:
	pass


func part_mult(part: String) -> float:
	match part:
		"head": return 2.0
		"leg": return 0.75
	return 1.0


func pick_target():
	# Prefer a survivor who is alone, then the closest, like the director's SI AI.
	var best = null
	var best_score := INF
	for s in Game.survivors:
		if not is_instance_valid(s) or s.dead or s.incapped or s.pinned_by != null:
			continue
		var d: float = s.global_position.distance_to(global_position)
		var near_friends := 0
		for o in Game.survivors:
			if o != s and is_instance_valid(o) and not o.dead and o.global_position.distance_to(s.global_position) < 6.0:
				near_friends += 1
		var score := d + near_friends * 6.0
		if score < best_score:
			best_score = score
			best = s
	return best


## Steer toward `pos` via the survivor flow field (or directly when visible).
func steer_to(pos: Vector3, speed: float, visible: bool) -> void:
	var to := pos - global_position
	to.y = 0
	var d := to.length()
	if d < 0.05:
		desired = Vector3.ZERO
		return
	if visible:
		desired = to / d * speed
	else:
		var dir: Vector3 = Game.level.field_survivors.direction(global_position)
		desired = (dir if dir != Vector3.ZERO else to / d) * speed


func pin_victim(s, kind_name: String) -> void:
	victim = s
	s.pin(self, kind_name)


func release_pin() -> void:
	if victim and is_instance_valid(victim):
		victim.unpin()
	victim = null


func shoved_off(_by) -> void:
	# Default: survivors can knock a special off a pinned teammate.
	release_pin()
	shove(_by.global_position, _by)
	ability_cd = 3.0


func die(attacker = null, part := "body", dmg_type := "bullet", dmg := 0.0) -> void:
	release_pin()
	if attacker and is_instance_valid(attacker) and attacker is Survivor and randf() < 0.6:
		Game.callout(attacker, "Got the %s!" % kind.capitalize())
	super.die(attacker, part, dmg_type, dmg)


func on_hurt(_attacker, _dmg: float, _t: String) -> void:
	pass


var _pin_acc := 0.0

func damage_victim(delta: float) -> void:
	if victim and is_instance_valid(victim):
		_pin_acc += pin_damage * Game.special_damage_mult() * delta
		if _pin_acc >= 5.0:
			victim.take_damage(_pin_acc, self, "pin")
			_pin_acc = 0.0
		if victim and is_instance_valid(victim) and victim.dead:
			release_pin()


func _after_stagger() -> void:
	state = S.SPECIAL
