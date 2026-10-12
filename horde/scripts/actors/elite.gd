class_name Elite
extends Infected
## Darktide-style elites that make you pick the right attack.
##   shieldbearer: armored. Light sweeps glance off; overheads, thrusts,
##                 chops and blunt weapons go through. Hits very hard.
##   rager:        fast three-hit flurries that must be blocked or dodged;
##                 a push interrupts the flurry.

var variant := "shieldbearer"
var flurry := 0
var flurry_t := 0.0


static func make(v: String) -> Elite:
	var e := Elite.new()
	e.variant = v
	return e


func _ready() -> void:
	kind = variant
	match variant:
		"shieldbearer":
			max_hp = 300.0
			run_speed = 4.4
			rig = SkinnedRig.create("warrior", {"tint": Color(0.55, 0.55, 0.6), "glow_eyes": Color(1.0, 0.55, 0.1, 1.0)})
			if rig is SkinnedRig:
				rig.attach_prop("res://assets/kaykit/skeletons/props/Skeleton_Shield_Large_A.gltf", "handslot.l")
				rig.attach_prop("res://assets/kaykit/skeletons/props/Skeleton_Axe.gltf", "handslot.r")
		"rager":
			max_hp = 180.0
			run_speed = 6.4
			rig = SkinnedRig.create("rogue", {"tint": Color(0.75, 0.45, 0.42), "glow_eyes": Color(1.0, 0.1, 0.1, 1.0)})
			if rig is SkinnedRig:
				rig.attach_prop("res://assets/kaykit/skeletons/props/Skeleton_Blade.gltf", "handslot.l")
				rig.attach_prop("res://assets/kaykit/skeletons/props/Skeleton_Blade.gltf", "handslot.r")
	hp = max_hp
	super._ready()


func is_armored() -> bool:
	return variant == "shieldbearer"


func part_mult(part: String) -> float:
	match part:
		"head": return 1.5 if is_armored() else 2.0
		"leg": return 0.75
	return 1.0


func take_damage(amount: float, attacker = null, part := "body", dmg_type := "bullet", hit_pos := Vector3.INF) -> void:
	if is_armored() and dmg_type == "bullet":
		amount *= 0.8 if amount >= 80.0 else 0.35
		if hit_pos != Vector3.INF and randf() < 0.6:
			Game.fx.impact(hit_pos, -(hit_pos - global_position).normalized())
	super.take_damage(amount, attacker, part, dmg_type, hit_pos)


func on_hurt(attacker, _dmg: float, _t: String) -> void:
	if state == S.IDLE or state == S.WANDER:
		alert(attacker)


func _do_attack() -> void:
	if target == null or not is_instance_valid(target) or target.dead:
		state = S.CHASE
		return
	if global_position.distance_to(target.global_position) > 1.8:
		state = S.CHASE
		return
	match variant:
		"shieldbearer":
			attack_t = randf_range(1.6, 2.0)
			rig.swing(0.7)
			attack_pending = 0.6     # long, readable windup
			Game.sfx.play3d("charger_roar", global_position + Vector3(0, 1.4, 0), -6.0, 0.2)
		"rager":
			attack_t = randf_range(1.3, 1.6)
			flurry = 3
			flurry_t = 0.25
			Game.sfx.play3d("hunter_screech", global_position + Vector3(0, 1.4, 0), -4.0, 0.2)


func special_physics(delta: float) -> void:
	if flurry > 0 and state != S.STAGGER:
		flurry_t -= delta
		if flurry_t <= 0.0:
			flurry -= 1
			flurry_t = 0.32
			rig.swing(0.28)
			attack_pending = 0.18


func _land_attack() -> void:
	if state == S.DEAD or state == S.STAGGER or target == null or not is_instance_valid(target) or target.dead:
		return
	var to: Vector3 = target.global_position - global_position
	to.y = 0
	if to.length() > 2.0:
		Game.sfx.play3d("swing", global_position + Vector3(0, 1.3, 0), -10.0, 0.2)
		return
	var mult := 4.0 if variant == "shieldbearer" else 1.5
	target.take_damage(Game.common_hit_damage() * mult + (6.0 if variant == "shieldbearer" else 2.0), self, "claw")
	Game.sfx.play3d("claw" if variant == "rager" else "tank_punch", target.global_position + Vector3(0, 1.2, 0), -4.0, 0.2)
	if variant == "shieldbearer" and not target.incapped:
		target.slow_t = 0.8


func shove(from: Vector3, by) -> void:
	flurry = 0
	if variant == "shieldbearer":
		# Shields soak pushes: just a short stumble.
		rig.flinch(Vector3(0, 0, 1), 4.0)
		attack_pending = 0.0
		return
	super.shove(from, by)


func melee_stagger(dir: Vector3, force: float) -> void:
	flurry = 0 if force >= 5.0 else flurry
	super.melee_stagger(dir, force * (0.5 if is_armored() else 1.0))
