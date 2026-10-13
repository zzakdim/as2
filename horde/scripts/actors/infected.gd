class_name Infected
extends CharacterBody3D
## Common infected. Specials extend this and override think()/special_physics().

enum S { IDLE, WANDER, CHASE, ATTACK, STAGGER, DEAD, SPECIAL }

const SKINS := [Color(0.55, 0.58, 0.48), Color(0.5, 0.48, 0.42), Color(0.6, 0.55, 0.5), Color(0.42, 0.45, 0.4)]
const SHIRTS := [Color(0.35, 0.3, 0.25), Color(0.2, 0.25, 0.35), Color(0.5, 0.48, 0.45), Color(0.4, 0.15, 0.12), Color(0.15, 0.3, 0.2), Color(0.55, 0.55, 0.6), Color(0.25, 0.25, 0.25)]
const PANTS := [Color(0.18, 0.2, 0.28), Color(0.3, 0.27, 0.2), Color(0.12, 0.12, 0.12), Color(0.35, 0.33, 0.3)]

var kind := "common"
var is_special := false
var hp := 50.0
var max_hp := 50.0
var state: int = S.IDLE
var rig: Rig
var shape: CollisionShape3D
var run_speed := 5.6
var walk_speed := 1.0
var accel := 18.0
var target = null           # Survivor
var think_t := 0.0
var attack_t := 0.0
var stagger_t := 0.0
var burn_t := 0.0
var burn_tick := 0.0
var dead_t := 0.0
var head_y := 1.5
var leg_y := 0.75
var can_be_shoved := true
var sitting := false
var wander_dir := Vector3.ZERO
var face_dir := Vector3.FORWARD
var desired := Vector3.ZERO
var has_los := false
var groan_t := 0.0
var fire_fx: Node3D = null
var attract_target = null
var last_attacker = null
var mob := false
# Set by whatever lands the killing blow; drives the ragdoll and gore.
var impact_dir := Vector3.ZERO
var impact_force := 0.0
var impact_point := Vector3.INF
var cut := ""
var _grav := 20.0
var _far := false


const COMMON_MODELS := ["minion", "minion", "minion", "warrior", "rogue", "mage"]
const COMMON_TINTS := [Color(0.62, 0.6, 0.55), Color(0.55, 0.6, 0.5), Color(0.66, 0.6, 0.52), Color(0.52, 0.54, 0.56), Color(0.7, 0.64, 0.58)]
static var use_box_rigs := false   # fallback to the procedural box figures

func setup_common() -> void:
	max_hp = 50.0
	hp = max_hp
	run_speed = randf_range(5.3, 6.0)
	if use_box_rigs:
		rig = BodyRig.make({
			"skin": SKINS.pick_random(), "shirt": SHIRTS.pick_random(), "pants": PANTS.pick_random(),
			"scale": randf_range(0.93, 1.07), "hunch": randf_range(0.05, 0.25),
		})
	else:
		rig = SkinnedRig.create(COMMON_MODELS.pick_random(), {"tint": COMMON_TINTS.pick_random()})


func _ready() -> void:
	collision_layer = Game.LAYER_INFECTED
	collision_mask = Game.LAYER_WORLD | Game.LAYER_SURVIVOR | Game.LAYER_INFECTED
	floor_snap_length = 0.3
	if rig == null:
		setup_common()
	if rig is SkinnedRig and rig.family == "human" and head_y < 1.55:
		head_y = 1.62 * rig.model_scale   # realistic adult proportions
		leg_y = 0.85 * rig.model_scale
	add_child(rig)
	shape = CollisionShape3D.new()
	var cap := CapsuleShape3D.new()
	cap.radius = collision_radius()
	cap.height = collision_height()
	shape.shape = cap
	shape.position.y = cap.height * 0.5
	add_child(shape)
	groan_t = randf_range(2.0, 10.0)
	if not Game.infected.has(self):
		Game.infected.append(self)
	if sitting:
		rig.set_pose("sit")
	if state == S.CHASE:
		rig.set_pose("zombie")


func collision_radius() -> float:
	return 0.3

func collision_height() -> float:
	return 1.75

func is_dead() -> bool:
	return state == S.DEAD


func _exit_tree() -> void:
	Game.infected.erase(self)


# ------------------------------------------------------------------ main loop

func _physics_process(delta: float) -> void:
	if state == S.DEAD:
		dead_t += delta
		rig.animate(delta, 0.0)
		if dead_t > 12.0:
			queue_free()
		return
	think_t -= delta
	if think_t <= 0.0:
		think_t = randf_range(0.18, 0.32)
		think()
	_update_burn(delta)
	if state == S.DEAD:
		return
	# Idle infected far from everyone don't need physics at all.
	if (state == S.IDLE) and _far:
		rig.animate(delta, 0.0)
		return
	special_physics(delta)
	var hv := Vector3(velocity.x, 0, velocity.z)
	var want := desired
	if state == S.STAGGER:
		stagger_t -= delta
		hv = hv.move_toward(Vector3.ZERO, 10.0 * delta)
		if stagger_t <= 0.0:
			_after_stagger()
	else:
		hv = hv.move_toward(want, accel * delta)
	velocity.x = hv.x
	velocity.z = hv.z
	if is_on_floor():
		velocity.y = -1.0
	else:
		velocity.y -= _grav * delta
	move_and_slide()
	if want.length_squared() > 0.1 and state != S.STAGGER:
		face_dir = face_dir.lerp(want.normalized(), min(1.0, delta * 8.0)).normalized()
	elif state == S.ATTACK and target and is_instance_valid(target):
		var to: Vector3 = target.global_position - global_position
		to.y = 0
		if to.length_squared() > 0.01:
			face_dir = face_dir.lerp(to.normalized(), min(1.0, delta * 10.0)).normalized()
	if face_dir.length_squared() > 0.01:
		rig.rotation.y = atan2(-face_dir.x, -face_dir.z)
	rig.animate(delta, Vector2(velocity.x, velocity.z).length())
	if attack_pending > 0.0:
		attack_pending -= delta
		if attack_pending <= 0.0:
			_land_attack()
	if state == S.ATTACK:
		attack_t -= delta
		if attack_t <= 0.0:
			_do_attack()
	groan_t -= delta
	if groan_t <= 0.0:
		groan_t = randf_range(4.0, 12.0) if state != S.CHASE else randf_range(2.5, 6.0)
		_vocalize()


func special_physics(_delta: float) -> void:
	pass


func _after_stagger() -> void:
	state = S.CHASE if target else S.IDLE


func _vocalize() -> void:
	if Game.player and global_position.distance_to(Game.player.global_position) < 30.0:
		Game.sfx.play3d("groan" if state != S.CHASE else "zombie_chase", global_position + Vector3(0, 1.5, 0), -8.0, 0.25)


# ------------------------------------------------------------------ brain

func think() -> void:
	var near = Game.nearest_survivor(global_position)
	if near == null:
		desired = Vector3.ZERO
		return
	var d: float = global_position.distance_to(near.global_position)
	_far = d > 45.0
	match state:
		S.IDLE, S.WANDER:
			desired = Vector3.ZERO
			if state == S.WANDER:
				desired = wander_dir * walk_speed
				if randf() < 0.1:
					state = S.IDLE
			elif randf() < 0.04 and not sitting:
				state = S.WANDER
				wander_dir = Vector3(randf_range(-1, 1), 0, randf_range(-1, 1)).normalized()
			# Notice survivors who come close or stand in plain view nearby.
			var notice := 7.0 if not sitting else 5.0
			if near.flashlight_on():
				notice += 3.0
			if d < notice or (d < 14.0 and randf() < 0.15 and Game.level.los(global_position, near.global_position)):
				alert(near)
			if Game.level.any_biled() and d < 40.0:
				alert(near)
			if not Game.attractors.is_empty():
				for a in Game.attractors:
					if is_instance_valid(a) and a.global_position.distance_to(global_position) < a.radius:
						alert(near)
		S.CHASE:
			_chase_think(near)
		S.ATTACK:
			if target == null or not is_instance_valid(target) or target.dead:
				state = S.CHASE
				return
			var td: float = global_position.distance_to(target.global_position)
			if td > 1.6:
				state = S.CHASE
			desired = Vector3.ZERO
			if td < 1.05:
				# Don't climb into the survivor's face; step back to arm's length.
				var away: Vector3 = global_position - target.global_position
				away.y = 0
				desired = away.normalized() * 1.5


func _pick_target(near) -> void:
	# Bile overrides everything; otherwise go for the nearest survivor.
	var best = near
	var bd := INF
	for s in Game.survivors:
		if not is_instance_valid(s) or s.dead or s.biled_time <= 0.0:
			continue
		var d: float = s.global_position.distance_squared_to(global_position)
		if d < bd:
			bd = d
			best = s
	target = best


func _chase_think(near) -> void:
	# Pipe bombs / bile jars pull the horde away from survivors.
	attract_target = null
	for a in Game.attractors:
		if is_instance_valid(a) and a.global_position.distance_to(global_position) < a.radius:
			attract_target = a
			break
	var lvl = Game.level
	if attract_target:
		var ad: float = attract_target.global_position.distance_to(global_position)
		if ad < 1.5:
			desired = Vector3(randf_range(-1, 1), 0, randf_range(-1, 1)) * 0.5
		elif ad < 8.0 or lvl.los(global_position, attract_target.global_position):
			var dir: Vector3 = attract_target.global_position - global_position
			dir.y = 0
			desired = dir.normalized() * run_speed
		else:
			desired = lvl.field_attract.direction(global_position) * run_speed
		return
	_pick_target(near)
	if target == null:
		return
	var to: Vector3 = target.global_position - global_position
	to.y = 0
	var d := to.length()
	if d < 1.25:
		state = S.ATTACK
		attack_t = randf_range(0.2, 0.5)
		desired = Vector3.ZERO
		rig.set_pose("zombie")
		return
	has_los = d < 14.0 and lvl.los(global_position, target.global_position)
	if has_los:
		desired = to / d * run_speed
	else:
		var field: FlowField = lvl.field_special if target.biled_time > 0.0 else lvl.field_survivors
		var dir := field.direction(global_position)
		if dir == Vector3.ZERO:
			dir = to / max(d, 0.01)
		desired = dir * run_speed
	# Mild separation so they flow around each other instead of conga-lining.
	desired += _separation() * 1.5


func _separation() -> Vector3:
	var push := Vector3.ZERO
	var my := global_position
	var n := 0
	for z in Game.infected:
		if z == self or not is_instance_valid(z) or z.state == S.DEAD:
			continue
		var o: Vector3 = my - z.global_position
		o.y = 0
		var l2 := o.length_squared()
		if l2 < 0.64 and l2 > 0.0001:
			push += o / l2 * 0.15
			n += 1
			if n > 6:
				break
	return push


func alert(by = null) -> void:
	if state == S.DEAD or state == S.SPECIAL:
		return
	if state == S.IDLE or state == S.WANDER:
		state = S.CHASE
		sitting = false
		rig.set_pose("zombie")
		_far = false
		think_t = randf_range(0.0, 0.3)
		if randf() < 0.3:
			Game.sfx.play3d("zombie_alert", global_position + Vector3(0, 1.5, 0), -4.0, 0.3)
	if by:
		target = by


func hear_noise(_pos: Vector3) -> void:
	if state == S.IDLE or state == S.WANDER:
		alert(Game.nearest_survivor(global_position))


var attack_pending := 0.0

func _do_attack() -> void:
	attack_t = randf_range(1.0, 1.3)
	if target == null or not is_instance_valid(target) or target.dead:
		state = S.CHASE
		return
	if global_position.distance_to(target.global_position) > 1.6:
		state = S.CHASE
		return
	# Telegraphed swing: the hit lands partway through, so it can be
	# blocked, perfect-blocked or dodged.
	rig.swing(0.4)
	attack_pending = 0.38
	if randf() < 0.3:
		Game.sfx.play3d("zombie_chase", global_position + Vector3(0, 1.4, 0), -6.0, 0.3)


func _land_attack() -> void:
	if state == S.DEAD or state == S.STAGGER or target == null or not is_instance_valid(target) or target.dead:
		return
	var to: Vector3 = target.global_position - global_position
	to.y = 0
	if to.length() > 1.75:
		Game.sfx.play3d("swing", global_position + Vector3(0, 1.3, 0), -12.0, 0.2)
		return   # whiffed: they stepped back
	target.take_damage(Game.common_hit_damage(), self, "claw")
	Game.sfx.play3d("claw", target.global_position + Vector3(0, 1.2, 0), -6.0, 0.2)


# ------------------------------------------------------------------ damage

## Returns "head", "body" or "leg" for a world-space hit point.
func hit_part(p: Vector3) -> String:
	var ly := p.y - global_position.y
	if rig.pose == "dead":
		return "body"
	var hy := head_y
	if rig.pose == "crouch":
		hy *= 0.7
	elif rig.pose == "sit":
		hy *= 0.55
	if ly > hy - 0.15:
		return "head"
	if ly < leg_y * (0.5 if rig.pose == "sit" else 1.0):
		return "leg"
	return "body"


func part_mult(part: String) -> float:
	match part:
		"head": return 4.0
		"leg": return 0.75
	return 1.0


func take_damage(amount: float, attacker = null, part := "body", dmg_type := "bullet", hit_pos := Vector3.INF) -> void:
	if state == S.DEAD:
		return
	if dmg_type != "melee" and dmg_type != "explosion":
		# Bullets: knock the body along the shot.
		impact_force = 0.0
		cut = ""
		if hit_pos != Vector3.INF:
			impact_point = hit_pos
	var dmg := amount * part_mult(part)
	hp -= dmg
	if dmg_type == "bullet" and attacker and is_instance_valid(attacker) and attacker is Node3D and hp > 0.0:
		# Rounds jolt the body (and snap the head back on headshots).
		rig.hit_react(global_position - attacker.global_position, clampf(dmg * 0.06, 0.8, 4.0), part)
	last_attacker = attacker
	if hit_pos != Vector3.INF:
		Game.fx.blood(hit_pos, 6 if dmg < 60 else 12)
	if hp <= 0.0:
		die(attacker, part, dmg_type, dmg)
		return
	on_hurt(attacker, dmg, dmg_type)


func on_hurt(attacker, _dmg: float, _dmg_type: String) -> void:
	if state == S.IDLE or state == S.WANDER:
		alert(attacker)


func shove(from: Vector3, _by) -> void:
	if state == S.DEAD or not can_be_shoved:
		return
	var dir := global_position - from
	dir.y = 0
	dir = dir.normalized()
	velocity = dir * 5.0 + Vector3(0, 1.5, 0)
	attack_pending = 0.0
	state = S.STAGGER
	stagger_t = randf_range(0.7, 1.0)
	sitting = false
	rig.set_pose("zombie")
	target = _by


func ignite(by) -> void:
	if state == S.DEAD:
		return
	if burn_t <= 0.0:
		fire_fx = Game.fx.attach_fire(self)
	burn_t = 6.0
	last_attacker = by
	alert(by)


func _update_burn(delta: float) -> void:
	if burn_t <= 0.0:
		return
	burn_t -= delta
	burn_tick -= delta
	if burn_tick <= 0.0:
		burn_tick = 0.5
		var dmg := 25.0 if not is_special else max_hp * 0.04 + 10.0
		take_damage(dmg, last_attacker, "body", "fire")
	if burn_t <= 0.0 and fire_fx and is_instance_valid(fire_fx):
		fire_fx.queue_free()
		fire_fx = null


func die(attacker = null, part := "body", dmg_type := "bullet", dmg := 0.0) -> void:
	state = S.DEAD
	dead_t = 0.0
	desired = Vector3.ZERO
	var body_vel := velocity
	velocity = Vector3.ZERO
	shape.set_deferred("disabled", true)
	collision_layer = 0
	var from_dir := -face_dir
	if attacker and is_instance_valid(attacker):
		from_dir = global_position - attacker.global_position
		from_dir.y = 0
		from_dir = from_dir.normalized()
	# Work out the killing impulse and any dismemberment.
	var impulse: Vector3
	if impact_force > 0.0:
		impulse = impact_dir * impact_force * 4.5 + Vector3(0, impact_force * 0.9, 0)
	else:
		impulse = from_dir * clamp(dmg * 0.09, 3.0, 22.0) + Vector3(0, 1.5, 0)
	if cut == "" and part == "head" and dmg_type == "bullet" and (dmg >= 140.0 or randf() < 0.2):
		cut = "split"
	if dmg_type == "explosion":
		cut = ["bisect", "decap", "arm", "gib"].pick_random()
	var point := impact_point if impact_point != Vector3.INF else global_position + Vector3(0, 1.1, 0)
	Game.fx.blood_decal(global_position)
	if fire_fx and is_instance_valid(fire_fx):
		fire_fx.queue_free()
	if attacker and is_instance_valid(attacker) and attacker.has_method("add_kill"):
		attacker.add_kill(self, part == "head")
	if Game.director:
		Game.director.on_infected_killed(self, attacker)
	on_death()
	Game.infected.erase(self)
	if rig.visible:
		rig.ragdoll(body_vel, impulse, point, cut)
	set_physics_process(false)
	queue_free.call_deferred()


func melee_stagger(dir: Vector3, force: float) -> void:
	if state == S.DEAD:
		return
	var need := 3.0
	match kind:
		"hunter", "smoker", "spitter", "boomer": need = 6.0
		"charger": need = 9.0
		"tank", "witch": need = 999.0
	if force >= need and (can_be_shoved or force >= 9.0) and kind != "tank" and kind != "witch":
		var d := dir
		d.y = 0
		velocity = d.normalized() * force * 0.45 + Vector3(0, 1.0, 0)
		state = S.STAGGER
		attack_pending = 0.0
		stagger_t = 0.45 + force * 0.04
		sitting = false
		if rig.pose == "sit":
			rig.set_pose("zombie")
	rig.flinch(rig.global_basis.inverse() * dir, force)
	rig.hit_react(dir, force)


func on_death() -> void:
	if randf() < 0.3:
		Game.sfx.play3d("zombie_die", global_position + Vector3(0, 1.2, 0), -6.0, 0.25)
