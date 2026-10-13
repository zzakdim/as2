class_name Charger
extends SpecialInfected
## Charges in a straight line, scattering survivors and carrying one off to
## pummel into the ground. Can't be shoved; kill it.

var phase := "stalk"
var phase_t := 0.0
var charge_dir := Vector3.ZERO
var hit_list: Array = []


func _ready() -> void:
	kind = "charger"
	max_hp = 600.0
	hp = max_hp
	run_speed = 5.0
	pin_damage = 15.0
	can_be_shoved = false
	tell_sound = "charger_roar"
	rig = SkinnedRig.create("warrior", {"tint": Color(0.9, 0.72, 0.62), "scale": 1.15, "role": "boss",
		"bone_scale": {"upperarm.r": 1.7, "hand.r": 1.35, "upperarm.l": 0.85, "chest": 1.1, "head": 0.85}})
	super._ready()


func collision_radius() -> float:
	return 0.45


func special_think() -> void:
	if phase != "stalk":
		return
	var t = pick_target()
	if t == null:
		desired = Vector3.ZERO
		return
	var d: float = t.global_position.distance_to(global_position)
	var vis: bool = d < 25.0 and Game.level.los(global_position, t.global_position)
	if vis and d < 16.0 and d > 3.0 and ability_cd <= 0.0:
		phase = "windup"
		phase_t = 0.45
		charge_dir = t.global_position - global_position
		charge_dir.y = 0
		charge_dir = charge_dir.normalized()
		face_dir = charge_dir
		desired = Vector3.ZERO
		Game.sfx.play3d("charger_roar", global_position + Vector3(0, 1.5, 0), 4.0, 0.05)
		return
	rig.set_pose("zombie")
	steer_to(t.global_position, run_speed, vis and d < 10.0)


func special_physics(delta: float) -> void:
	match phase:
		"windup":
			desired = Vector3.ZERO
			phase_t -= delta
			if phase_t <= 0.0:
				phase = "charge"
				phase_t = 0.0
				hit_list.clear()
				accel = 60.0
		"charge":
			phase_t += delta
			desired = charge_dir * 12.0
			face_dir = charge_dir
			for s in Game.survivors:
				if not is_instance_valid(s) or s.dead or s in hit_list or s == victim:
					continue
				var to: Vector3 = s.global_position - global_position
				to.y = 0
				if to.length() < 1.5:
					hit_list.append(s)
					if victim == null and s.pinned_by == null and not s.incapped:
						pin_victim(s, "charger")
						collision_mask = Game.LAYER_WORLD
					else:
						var side := charge_dir.cross(Vector3.UP) * (1.0 if to.dot(charge_dir.cross(Vector3.UP)) > 0 else -1.0)
						s.knockback(side * 6.0 + charge_dir * 4.0 + Vector3(0, 4, 0), 1.2)
						s.take_damage(10.0 * Game.special_damage_mult(), self, "charge")
			if victim and is_instance_valid(victim):
				victim.global_position = global_position + charge_dir * 0.9
			var stalled := phase_t > 0.3 and Vector2(velocity.x, velocity.z).length() < 4.0
			if phase_t > 2.5 or stalled or is_on_wall():
				accel = 18.0
				Game.fx.add_shake(global_position, 0.5)
				Game.sfx.play3d("tank_punch", global_position + Vector3(0, 1, 0), 0.0)
				if victim and is_instance_valid(victim):
					victim.take_damage(10.0 * Game.special_damage_mult(), self, "charge")
					phase = "pummel"
				else:
					phase = "recover"
					phase_t = 1.5
					ability_cd = 4.0
		"pummel":
			desired = Vector3.ZERO
			if victim == null or not is_instance_valid(victim):
				release_pin()
				return
			if randf() < delta * 2.0:
				rig.swing(0.4)
			damage_victim(delta)
		"recover":
			desired = Vector3.ZERO
			phase_t -= delta
			if phase_t <= 0.0:
				phase = "stalk"


func release_pin() -> void:
	super.release_pin()
	phase = "stalk"
	ability_cd = 6.0
	accel = 18.0
	collision_mask = Game.LAYER_WORLD | Game.LAYER_SURVIVOR | Game.LAYER_INFECTED


func shoved_off(_by) -> void:
	pass  # chargers must be killed
