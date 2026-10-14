class_name Elite
extends Infected
## Darktide-style elites that make you pick the right attack.
##   shieldbearer: armored. Light sweeps glance off; overheads, thrusts,
##                 chops and blunt weapons go through. Hits very hard.
##   rager:        fast three-hit flurries that must be blocked or dodged;
##                 a push interrupts the flurry.
##   gunner:       keeps its distance and shoots. A red laser telegraphs the
##                 aim, then a burst follows: break line of sight, dodge or
##                 sprint across it, or close in and cut it down.

var variant := "shieldbearer"
var flurry := 0
var flurry_t := 0.0
var aim_t := 0.0
var burst := 0
var shot_t := 0.0
var fire_cd := 2.0
var laser: MeshInstance3D
var aim_pos := Vector3.ZERO


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
			if rig is SkinnedRig and rig.family == "human":
				var sh := Node3D.new()
				WeaponMesh.riot_shield(sh)
				# The hand frame's -Z runs down the fingers: stand the slab up.
				sh.basis = Basis(Vector3(0, 0, 1), PI * 0.3) * Basis(Vector3(1, 0, 0), PI / 2)
				sh.position = Vector3(0, 0, -0.1)
				rig.held_left().add_child(sh)
				rig.held.add_child(WeaponData.build_model("fire_axe"))
			elif rig is SkinnedRig:
				rig.attach_prop("res://assets/kaykit/skeletons/props/Skeleton_Shield_Large_A.gltf", "handslot.l")
				rig.attach_prop("res://assets/kaykit/skeletons/props/Skeleton_Axe.gltf", "handslot.r")
		"rager":
			max_hp = 180.0
			run_speed = 6.4
			rig = SkinnedRig.create("rogue", {"tint": Color(0.75, 0.45, 0.42), "glow_eyes": Color(1.0, 0.1, 0.1, 1.0)})
			if rig is SkinnedRig and rig.family == "human":
				rig.held.add_child(WeaponData.build_model("machete"))
				rig.held_left().add_child(WeaponData.build_model("machete"))
			elif rig is SkinnedRig:
				rig.attach_prop("res://assets/kaykit/skeletons/props/Skeleton_Blade.gltf", "handslot.l")
				rig.attach_prop("res://assets/kaykit/skeletons/props/Skeleton_Blade.gltf", "handslot.r")
		"gunner":
			max_hp = 140.0
			run_speed = 4.6
			rig = SkinnedRig.create("mage", {"tint": Color(0.5, 0.52, 0.45), "glow_eyes": Color(1.0, 0.2, 0.15, 1.0)})
			if rig.held:
				rig.held.add_child(WeaponData.build_model("assault_rifle"))
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
	if variant == "gunner":
		_gunner_physics(delta)
		return
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
	_stop_aim()
	if variant == "shieldbearer":
		# Shields soak pushes: just a short stumble.
		rig.flinch(Vector3(0, 0, 1), 4.0)
		attack_pending = 0.0
		return
	super.shove(from, by)


func melee_stagger(dir: Vector3, force: float) -> void:
	flurry = 0 if force >= 5.0 else flurry
	if force >= 3.0:
		_stop_aim()
	super.melee_stagger(dir, force * (0.5 if is_armored() else 1.0))


func on_death() -> void:
	_stop_aim()
	super.on_death()


# ------------------------------------------------------------------ gunner

func think() -> void:
	if variant != "gunner" or state == S.IDLE or state == S.WANDER or state == S.STAGGER:
		super.think()
		return
	if state == S.SPECIAL:
		desired = Vector3.ZERO
		if target == null or not is_instance_valid(target) or target.dead \
				or not Game.level.los(_muzzle(), _aim_point()):
			_stop_aim()
			state = S.CHASE
			fire_cd = randf_range(0.6, 1.2)
		return
	super.think()
	if state != S.CHASE or target == null or not is_instance_valid(target):
		return
	var d: float = global_position.distance_to(target.global_position)
	if d < 5.0 or d > 26.0:
		return
	if not Game.level.los(_muzzle(), _aim_point()):
		return
	if fire_cd <= 0.0:
		_start_aim()
	elif d < 12.0:
		# Hold the firing line: sidestep instead of walking into melee range.
		var to: Vector3 = target.global_position - global_position
		to.y = 0
		var side := Vector3(-to.z, 0, to.x).normalized() * (1.0 if get_instance_id() % 2 == 0 else -1.0)
		desired = (side * 1.6 - to.normalized() * (1.5 if d < 8.0 else 0.0))


func _muzzle() -> Vector3:
	return global_position + Vector3(0, 1.45, 0) + face_dir * 0.55


func _aim_point() -> Vector3:
	return target.global_position + Vector3(0, 1.2, 0)


func _start_aim() -> void:
	state = S.SPECIAL
	desired = Vector3.ZERO
	aim_t = 0.95 if Game.difficulty < Game.Diff.ADVANCED else 0.75
	burst = 0
	aim_pos = _aim_point()
	rig.set_pose("aim")
	Game.sfx.play3d("zombie_alert", global_position + Vector3(0, 1.5, 0), -2.0, 0.1)
	if laser == null:
		laser = MeshInstance3D.new()
		var m := CylinderMesh.new()
		m.top_radius = 0.006
		m.bottom_radius = 0.006
		m.height = 1.0
		m.radial_segments = 4
		m.rings = 1
		laser.mesh = m
		var mat := StandardMaterial3D.new()
		mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		mat.albedo_color = Color(1.0, 0.1, 0.05)
		mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		mat.albedo_color.a = 0.75
		laser.material_override = mat
		laser.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		laser.top_level = true
		add_child(laser)


func _stop_aim() -> void:
	aim_t = 0.0
	burst = 0
	if laser:
		laser.queue_free()
		laser = null
	if state == S.SPECIAL:
		state = S.CHASE
		rig.set_pose("zombie")


func _gunner_physics(delta: float) -> void:
	fire_cd -= delta
	if state != S.SPECIAL:
		return
	if target == null or not is_instance_valid(target) or target.dead:
		_stop_aim()
		return
	var to: Vector3 = target.global_position - global_position
	to.y = 0
	if to.length_squared() > 0.01:
		face_dir = face_dir.lerp(to.normalized(), min(1.0, delta * 6.0)).normalized()
	var a := _muzzle()
	aim_pos = aim_pos.lerp(_aim_point(), minf(1.0, delta * 3.5))
	var b := aim_pos
	if laser:
		# The laser lags the target a little, so moving fast makes it slide off.
		var len := a.distance_to(b)
		var dir: Vector3 = (b - a) / maxf(len, 0.01)
		var x := dir.cross(Vector3.UP if absf(dir.y) < 0.95 else Vector3.RIGHT).normalized()
		var z := x.cross(dir)
		laser.global_transform = Transform3D(Basis(x, dir * len, z), a.lerp(b, 0.5))
		laser.visible = burst > 0 or fmod(aim_t, 0.16) > 0.05
	if aim_t > 0.0:
		aim_t -= delta
		if aim_t <= 0.0:
			burst = 9
			shot_t = 0.0
		return
	shot_t -= delta
	if shot_t > 0.0:
		return
	shot_t = 0.11
	burst -= 1
	_fire(a, b)
	if burst <= 0:
		_stop_aim()
		fire_cd = randf_range(3.0, 5.0)


func _fire(a: Vector3, b: Vector3) -> void:
	Game.sfx.play3d("shot_smg", a, -3.0, 0.08)
	Game.fx.muzzle_flash(a, (b - a).normalized())
	Game.make_noise(a, 12.0)
	var d := a.distance_to(b)
	var chance := clampf(0.6 - d * 0.012, 0.2, 0.6)
	# The aim trails the target: moving across the line of fire drags the
	# laser off you, and a dodge slips the burst entirely.
	chance *= clampf(1.0 - b.distance_to(_aim_point()) / 0.7, 0.0, 1.0)
	if target.dodge_t > 0.0:
		chance = 0.0
	if target.want_crouch:
		chance *= 0.7
	if randf() < chance:
		Game.fx.tracer(a, b)
		target.take_damage(Game.common_hit_damage() * 0.6 + 1.2, self, "shot")
	else:
		var miss := b + Vector3(randf_range(-1, 1), randf_range(-0.6, 0.8), randf_range(-1, 1)).normalized() * randf_range(0.5, 1.2)
		var end := a + (miss - a).normalized() * (d + 6.0)
		Game.fx.tracer(a, end)
