class_name Melee
extends RefCounted
## Darktide-style melee.
##
## Tap LMB for the light chain, hold for a charged heavy, hold RMB to block,
## LMB while blocking to push, LMB right after a push for the push-attack.
## Every swing is a real arc in camera space: the same transform drives the
## first-person blade and the hit sweep, so what you see is what you hit.
## Feel comes from weapon-side "drag" on contact (the blade slows as it carves
## through bodies, like Vermintide/Darktide - no global slow-mo), a camera
## punch in the swing direction, and a cleave budget that the horde eats.

const DEG := PI / 180.0
const HOLD_FOR_HEAVY := 0.24

# Swing direction "dir" is screen-space degrees: 0 = left->right, 90 = top->down,
# 180 = right->left, 35 = down-right diagonal. "arc" is the start/end angle of
# the blade around that sweep (0 = pointing straight ahead).
const MOVESETS := {
	"greatsword": {
		"length": 1.18, "grip": 0.34, "pivot": Vector3(0.08, -0.36, -0.3),
		"stamina": 4.0, "block_cost": 0.5, "push_cost": 1.0, "block_arc": 0.25,
		"light": [
			{"name": "Light 1", "dir": 32.0, "arc": [-60.0, 64.0], "windup": 0.17, "strike": 0.13, "follow": 0.11, "recover": 0.34,
				"damage": 150.0, "cleave": 3.5, "impact": 4.5, "lunge": 1.6, "next_light": 1, "next_heavy": 1},
			{"name": "Light 2", "dir": 148.0, "arc": [-60.0, 64.0], "windup": 0.16, "strike": 0.13, "follow": 0.11, "recover": 0.34,
				"damage": 150.0, "cleave": 3.5, "impact": 4.5, "lunge": 1.6, "next_light": 2, "next_heavy": 0},
			{"name": "Overhead", "dir": 88.0, "arc": [-58.0, 60.0], "windup": 0.24, "strike": 0.12, "follow": 0.12, "recover": 0.4,
				"damage": 320.0, "cleave": 1.6, "impact": 7.0, "lunge": 2.2, "next_light": 0, "next_heavy": 0, "split": true},
		],
		"heavy": [
			{"name": "Heavy sweep L>R", "dir": 6.0, "arc": [-66.0, 72.0], "windup": 0.08, "strike": 0.2, "follow": 0.16, "recover": 0.42,
				"damage": 240.0, "cleave": 10.0, "impact": 10.0, "lunge": 3.2, "charge": 0.45, "next_light": 2, "next_heavy": 1, "bisect": true},
			{"name": "Heavy sweep R>L", "dir": 174.0, "arc": [-66.0, 72.0], "windup": 0.08, "strike": 0.2, "follow": 0.16, "recover": 0.42,
				"damage": 240.0, "cleave": 10.0, "impact": 10.0, "lunge": 3.2, "charge": 0.45, "next_light": 2, "next_heavy": 0, "bisect": true},
		],
		"push": {"windup": 0.06, "active": 0.1, "recover": 0.3, "range": 2.6, "arc": 0.35, "force": 6.0},
		"push_attack": {"name": "Thrust", "thrust": true, "windup": 0.1, "strike": 0.12, "follow": 0.1, "recover": 0.36,
			"damage": 380.0, "cleave": 4.0, "impact": 9.0, "lunge": 5.0, "next_light": 1, "next_heavy": 0},
	},
	"fire_axe": {
		"length": 0.62, "grip": 0.42, "pivot": Vector3(0.12, -0.34, -0.3), "head_mass": true,
		"stamina": 3.0, "block_cost": 0.6, "push_cost": 1.0, "block_arc": 0.3,
		"light": [
			{"name": "Chop L", "dir": 58.0, "arc": [-58.0, 58.0], "windup": 0.15, "strike": 0.12, "follow": 0.1, "recover": 0.3,
				"damage": 190.0, "cleave": 1.6, "impact": 5.0, "lunge": 1.2, "next_light": 1, "next_heavy": 0, "split": true},
			{"name": "Chop R", "dir": 122.0, "arc": [-58.0, 58.0], "windup": 0.15, "strike": 0.12, "follow": 0.1, "recover": 0.3,
				"damage": 190.0, "cleave": 1.6, "impact": 5.0, "lunge": 1.2, "next_light": 2, "next_heavy": 0, "split": true},
			{"name": "Sweep", "dir": 12.0, "arc": [-60.0, 64.0], "windup": 0.16, "strike": 0.14, "follow": 0.1, "recover": 0.32,
				"damage": 140.0, "cleave": 3.0, "impact": 5.0, "lunge": 1.4, "next_light": 0, "next_heavy": 0},
		],
		"heavy": [
			{"name": "Overhead chop", "dir": 90.0, "arc": [-58.0, 60.0], "windup": 0.06, "strike": 0.13, "follow": 0.12, "recover": 0.4,
				"damage": 420.0, "cleave": 1.2, "impact": 9.0, "lunge": 2.5, "charge": 0.42, "next_light": 1, "next_heavy": 0, "split": true},
		],
		"push": {"windup": 0.05, "active": 0.1, "recover": 0.28, "range": 2.4, "arc": 0.38, "force": 5.5},
		"push_attack": {"name": "Hook", "dir": 165.0, "arc": [-50.0, 50.0], "windup": 0.08, "strike": 0.11, "follow": 0.1, "recover": 0.3,
			"damage": 200.0, "cleave": 2.5, "impact": 7.0, "lunge": 2.0, "next_light": 0, "next_heavy": 0},
	},
	"sledgehammer": {
		"length": 0.72, "grip": 0.6, "pivot": Vector3(0.08, -0.38, -0.3), "head_mass": true,
		"stamina": 5.0, "block_cost": 0.35, "push_cost": 0.8, "block_arc": 0.2,
		"light": [
			{"name": "Swing L>R", "dir": 15.0, "arc": [-62.0, 66.0], "windup": 0.24, "strike": 0.17, "follow": 0.14, "recover": 0.42,
				"damage": 160.0, "cleave": 5.0, "impact": 11.0, "lunge": 1.5, "next_light": 1, "next_heavy": 0},
			{"name": "Swing R>L", "dir": 165.0, "arc": [-62.0, 66.0], "windup": 0.24, "strike": 0.17, "follow": 0.14, "recover": 0.42,
				"damage": 160.0, "cleave": 5.0, "impact": 11.0, "lunge": 1.5, "next_light": 0, "next_heavy": 0},
		],
		"heavy": [
			{"name": "Slam", "dir": 90.0, "arc": [-60.0, 62.0], "windup": 0.08, "strike": 0.16, "follow": 0.1, "recover": 0.55,
				"damage": 500.0, "cleave": 6.0, "impact": 15.0, "lunge": 1.0, "charge": 0.7, "next_light": 0, "next_heavy": 0,
				"slam": 3.2},
		],
		"push": {"windup": 0.06, "active": 0.12, "recover": 0.32, "range": 2.8, "arc": 0.3, "force": 8.0},
		"push_attack": {"name": "Uppercut", "dir": 270.0, "arc": [-50.0, 55.0], "windup": 0.1, "strike": 0.14, "follow": 0.12, "recover": 0.4,
			"damage": 260.0, "cleave": 4.0, "impact": 13.0, "lunge": 2.0, "next_light": 0, "next_heavy": 0},
	},
	"machete": {
		"length": 0.52, "grip": 0.14, "pivot": Vector3(0.16, -0.3, -0.3),
		"stamina": 3.0, "block_cost": 0.6, "push_cost": 1.0, "block_arc": 0.3,
		"light": [
			{"name": "Slash 1", "dir": 20.0, "arc": [-60.0, 64.0], "windup": 0.1, "strike": 0.1, "follow": 0.08, "recover": 0.24,
				"damage": 120.0, "cleave": 2.0, "impact": 3.0, "lunge": 1.0, "next_light": 1, "next_heavy": 0},
			{"name": "Slash 2", "dir": 160.0, "arc": [-60.0, 64.0], "windup": 0.1, "strike": 0.1, "follow": 0.08, "recover": 0.24,
				"damage": 120.0, "cleave": 2.0, "impact": 3.0, "lunge": 1.0, "next_light": 0, "next_heavy": 0},
		],
		"heavy": [
			{"name": "Chop", "dir": 80.0, "arc": [-58.0, 60.0], "windup": 0.06, "strike": 0.12, "follow": 0.1, "recover": 0.34,
				"damage": 260.0, "cleave": 1.5, "impact": 6.0, "lunge": 2.0, "charge": 0.35, "next_light": 1, "next_heavy": 0, "split": true},
		],
		"push": {"windup": 0.05, "active": 0.1, "recover": 0.25, "range": 2.3, "arc": 0.4, "force": 5.0},
		"push_attack": {"name": "Stab", "thrust": true, "windup": 0.08, "strike": 0.1, "follow": 0.08, "recover": 0.3,
			"damage": 200.0, "cleave": 2.0, "impact": 5.0, "lunge": 3.0, "next_light": 0, "next_heavy": 0},
	},
}

# How much cleave budget each enemy type soaks up.
const HIT_MASS := {"common": 1.0, "boomer": 1.5, "spitter": 2.0, "hunter": 2.5, "smoker": 2.5, "charger": 4.0, "witch": 6.0, "tank": 99.0}

var s                       # Survivor
var ms: Dictionary = {}
var weapon_id := ""
var state := "idle"         # idle, windup, charge, strike, follow, recover, block, push
var t := 0.0
var atk: Dictionary = {}
var light_i := 0
var heavy_i := 0
var is_heavy := false
var press_t := 0.0
var queued := false
var theta := 0.0
var theta_prev := 0.0
var drag_t := 0.0
var drag_scale := 1.0
var budget := 0.0
var hit_set := {}
var kills_this_swing := 0
var candidates: Array = []
var stamina := 4.0
var stamina_delay := 0.0
var push_window := 0.0
var idle_t := 0.0
var stopped := false
var pose := Transform3D()   # blade root, camera-local
var _pose_from := Transform3D()
var cam_punch := Vector2.ZERO        # (pitch, yaw) radians, decays; read by the camera
var blood := 0.0                     # how gory the blade is (0..1)
var _fire_prev := false
var lunge := Vector3.ZERO


func _init(owner_s) -> void:
	s = owner_s


## For the pose contact sheet (--melee-poses): returns the blade pose for an
## attack frozen at a phase. kind: light/heavy/push_attack/idle/block/push.
func pose_for(kind: String, i: int, phase: String, k: float) -> Transform3D:
	match kind:
		"idle": return idle_pose()
		"block": return block_pose()
		"push": return block_pose().interpolate_with(push_pose(), k)
		"push_attack": atk = ms["push_attack"]
		_: atk = ms[kind][i]
	is_heavy = kind != "light"
	match phase:
		"windup": return idle_pose().interpolate_with(_windup_pose(), _ease_out(k))
		"charge": return _windup_pose(true)
		"strike":
			t = k * atk["strike"]
			return _attack_pose(_strike_theta(_ease_in_out(k)), k)
		"follow": return _attack_pose(_strike_theta(1.0) + _ease_out(k) * 14.0 * DEG, 1.0)
	return idle_pose()


func set_weapon(id: String) -> void:
	if id == weapon_id:
		return
	weapon_id = id
	var def := WeaponData.get_def(id)
	ms = MOVESETS.get(def.get("moveset", "machete"), MOVESETS["machete"])
	stamina = ms["stamina"]
	reset()
	pose = idle_pose()


func reset() -> void:
	state = "idle"
	t = 0.0
	light_i = 0
	heavy_i = 0
	queued = false
	lunge = Vector3.ZERO
	drag_t = 0.0


func is_blocking() -> bool:
	return state == "block"


func is_busy() -> bool:
	return state != "idle" and state != "block"


## Movement speed multiplier while charging / blocking.
func move_mult() -> float:
	match state:
		"charge": return 0.6
		"block": return 0.65
		"strike", "follow": return 0.85
	return 1.0


# ===================================================================== update

func update(delta: float, fire_held: bool, block_held: bool) -> void:
	var fire_pressed := fire_held and not _fire_prev
	_fire_prev = fire_held
	cam_punch = cam_punch.lerp(Vector2.ZERO, min(1.0, delta * 14.0))
	# Stamina
	if stamina_delay > 0.0:
		stamina_delay -= delta
	else:
		stamina = min(ms["stamina"], stamina + delta * (0.5 if state == "block" else 1.0))
	push_window = max(0.0, push_window - delta)
	# Weapon-side hit drag: the swing itself slows while carving through bodies.
	var dt := delta
	if drag_t > 0.0:
		drag_t -= delta
		dt *= drag_scale
	if fire_held:
		press_t += delta
	lunge = Vector3.ZERO

	match state:
		"idle":
			idle_t += delta
			if idle_t > 0.7:
				light_i = 0
				heavy_i = 0
			pose = pose.interpolate_with(idle_pose(), min(1.0, delta * 10.0))
			if block_held:
				_enter("block")
			elif fire_pressed:
				_start_attack(false)
		"block":
			pose = pose.interpolate_with(block_pose(), min(1.0, delta * 16.0))
			if not block_held:
				_enter("idle")
			elif fire_pressed:
				_start_push()
		"push":
			t += dt
			var p: Dictionary = ms["push"]
			var k: float = clamp(t / (p["windup"] + p["active"]), 0.0, 1.0)
			pose = _pose_from.interpolate_with(push_pose(), _ease_out(k))
			if t >= p["windup"] and not atk.get("_pushed", false):
				atk["_pushed"] = true
				_do_push()
			if t >= p["windup"] + p["active"]:
				pose = pose.interpolate_with(block_pose(), min(1.0, delta * 8.0))
			if fire_pressed and t > p["windup"]:
				_start_push_attack()
			elif t >= p["windup"] + p["active"] + p["recover"]:
				push_window = 0.4
				_enter("block" if block_held else "idle")
		"windup":
			t += dt
			var k: float = clamp(t / atk["windup"], 0.0, 1.0)
			pose = _pose_from.interpolate_with(_windup_pose(), _ease_out(k))
			if not is_heavy and fire_held and press_t >= HOLD_FOR_HEAVY and not atk.get("thrust", false):
				# Held long enough: this becomes a heavy.
				is_heavy = true
				atk = ms["heavy"][heavy_i % ms["heavy"].size()]
				_pose_from = pose
				_enter("charge")
			elif k >= 1.0 and (not fire_held or atk.get("thrust", false) or press_t > HOLD_FOR_HEAVY):
				_begin_strike()
		"charge":
			t += dt
			var k: float = clamp(t / atk["charge"], 0.0, 1.0)
			var shake := Vector3(randf_range(-1, 1), randf_range(-1, 1), 0) * 0.004 * k
			var cp := _windup_pose(true)
			cp.origin += shake
			pose = _pose_from.interpolate_with(cp, _ease_out(min(1.0, t / 0.25)))
			if t >= atk["charge"] and not atk.get("_full", false):
				atk = atk.duplicate()
				atk["_full"] = true
				Game.sfx.play3d("beep", s.eye_pos(), -14.0, 0.0)
				if s.controller and s.controller.has_method("on_full_charge"):
					s.controller.on_full_charge()
			if block_held and stamina > 0.0:
				_enter("block")   # cancel the heavy into a block
			elif (not fire_held and t >= atk["charge"]) or t >= 1.6:
				_begin_strike()
		"strike":
			t += dt
			var k: float = clamp(t / atk["strike"], 0.0, 1.0)
			theta_prev = theta
			theta = _strike_theta(_ease_in_out(k))
			pose = _attack_pose(theta, k)
			lunge = s.flat_forward() * atk.get("lunge", 0.0) * (1.0 - k)
			_sweep(theta_prev, theta)
			if fire_pressed:
				queued = true
			if k >= 1.0 and atk.has("slam") and not atk.get("_slammed", false):
				_slam(atk["slam"])
			if stopped:
				_enter("recover")
			elif k >= 1.0:
				_enter("follow")
		"follow":
			t += dt
			var k: float = clamp(t / atk["follow"], 0.0, 1.0)
			theta_prev = theta
			theta = _strike_theta(1.0) + _ease_out(k) * 14.0 * DEG
			pose = _attack_pose(theta, 1.0)
			if fire_pressed:
				queued = true
			if k >= 1.0:
				if queued or fire_held:
					_start_attack(true)
				else:
					_enter("recover")
		"recover":
			t += dt
			var dur: float = atk.get("recover", 0.3) * (0.6 if stopped else 1.0)
			var k: float = clamp(t / dur, 0.0, 1.0)
			pose = _pose_from.interpolate_with(idle_pose(), _ease_in_out(k))
			if fire_pressed or queued:
				_start_attack(true)
			elif block_held and t > 0.08:
				_enter("block")
			elif k >= 1.0:
				_enter("idle")


func _enter(st: String) -> void:
	state = st
	t = 0.0
	_pose_from = pose
	if st == "idle":
		idle_t = 0.0
	if st == "recover":
		queued = false


func _start_attack(chained: bool) -> void:
	if not chained:
		press_t = 0.0
	else:
		press_t = 0.0 if not _fire_prev else press_t
	queued = false
	is_heavy = false
	stopped = false
	atk = ms["light"][light_i % ms["light"].size()]
	_enter("windup")


func _start_push() -> void:
	if stamina <= 0.0:
		Game.sfx.play3d("dry_fire", s.eye_pos(), -6.0)
		return
	_use_stamina(ms["push_cost"])
	atk = {"_pushed": false}
	_enter("push")
	Game.sfx.play3d("swing", s.eye_pos(), -2.0, 0.1)


func _start_push_attack() -> void:
	atk = ms["push_attack"]
	is_heavy = true
	stopped = false
	press_t = 0.0
	_enter("windup")


func _begin_strike() -> void:
	if atk.has("slam"):
		atk = atk.duplicate()   # per-swing flag below
	budget = atk["cleave"]
	hit_set.clear()
	kills_this_swing = 0
	candidates.clear()
	var eye: Vector3 = s.eye_pos()
	for z in Game.infected:
		if is_instance_valid(z) and not z.is_dead() and z.global_position.distance_to(eye) < 4.5:
			candidates.append(z)
	theta = _strike_theta(0.0)
	theta_prev = theta
	_enter("strike")
	Game.sfx.play3d("whoosh_heavy" if is_heavy else "whoosh", s.eye_pos(), -2.0 if is_heavy else -5.0, 0.12)
	# After the strike decides the chain, advance it.
	light_i = atk.get("next_light", 0)
	heavy_i = atk.get("next_heavy", 0)


func _use_stamina(n: float) -> void:
	stamina -= n
	stamina_delay = 0.8


# ===================================================================== geometry

func _axes() -> Array:
	# Swing basis in camera space: F forward, S sweep direction on screen.
	var d: float = atk.get("dir", 0.0) * DEG
	var F := Vector3(0, 0, -1)
	var S := Vector3(cos(d), -sin(d), 0)
	return [F, S]


func _strike_theta(k: float) -> float:
	if atk.get("thrust", false):
		return 0.0
	var arc: Array = atk["arc"]
	return lerp(float(arc[0]), float(arc[1]), k) * DEG


## Blade root transform in camera space for a sweep angle. The blade lies
## along -Z of the returned basis, edge leading in the swing direction.
func _attack_pose(th: float, k: float) -> Transform3D:
	var piv: Vector3 = ms["pivot"]
	if atk.get("thrust", false):
		var v := Vector3(0.06, 0.1, -1).normalized()
		var o := piv + Vector3(-0.06, 0.1, 0.22) + Vector3(0, 0.02, -0.5) * _ease_out(k)
		return _blade_xf(o, v, Vector3(1, 0, 0))
	var ax := _axes()
	var F: Vector3 = ax[0]
	var S: Vector3 = ax[1]
	var U := _cant_axis(S)
	# Blade is canted off the sweep plane so it never points straight down
	# the line of sight mid-swing.
	var v := (F * cos(th) + S * sin(th) + U * 0.3).normalized()
	var tangent := (-F * sin(th) + S * cos(th)).normalized()
	# The hands travel across the body with the swing and reach out at the
	# middle of the arc; keeping them in front of the camera keeps the whole
	# swing on screen.
	var o: Vector3 = piv + S * 0.22 * sin(th) + F * 0.12 * cos(th) + U * 0.05 * cos(th)
	return _blade_xf(o, v, tangent)


## Screen-space direction perpendicular to the sweep, biased upward.
func _cant_axis(S: Vector3) -> Vector3:
	var u := Vector3(-S.y, S.x, 0)
	if u.y < 0.0:
		u = -u
	if abs(S.y) > 0.9:
		u = Vector3(0.6, 0, 0.0) * (1.0 if S.y < 0 else -1.0)  # overheads lean slightly right
	return u.normalized() if u.length_squared() > 0.001 else Vector3.UP


func _blade_xf(origin: Vector3, v: Vector3, tangent: Vector3) -> Transform3D:
	var z := -v
	var x := tangent - v * tangent.dot(v)
	if x.length_squared() < 0.0001:
		x = Vector3.RIGHT
	x = x.normalized()
	var y := z.cross(x).normalized()
	return Transform3D(Basis(x, y, z), origin)


func _windup_pose(charged := false) -> Transform3D:
	var piv: Vector3 = ms["pivot"]
	if atk.get("thrust", false):
		return _blade_xf(piv + Vector3(-0.05, 0.1, 0.3), Vector3(0.05, 0.1, -1).normalized(), Vector3.RIGHT)
	var ax := _axes()
	var F: Vector3 = ax[0]
	var S: Vector3 = ax[1]
	var U := _cant_axis(S)
	var arc: Array = atk["arc"]
	var th := float(arc[0]) * DEG - (0.22 if charged else 0.1)
	# Blade cocked back over the shoulder it swings from, tip up and in view.
	var v := (F * cos(th) * 0.9 + S * sin(th) + U * (0.45 if charged else 0.35)).normalized()
	var tangent := (-F * sin(th) + S * cos(th)).normalized()
	var o: Vector3 = piv + S * 0.22 * sin(th) + F * 0.04 + U * 0.08 + Vector3(0, 0.02, 0.08 if charged else 0.04)
	return _blade_xf(o, v, tangent)


func idle_pose() -> Transform3D:
	var v := Vector3(0.12, 0.8, -0.58).normalized()
	return _blade_xf(Vector3(0.24, -0.4, -0.24), v, Vector3(-1, 0, 0.2).normalized())


func block_pose() -> Transform3D:
	var v := Vector3(-0.96, 0.2, -0.22).normalized()
	return _blade_xf(Vector3(0.36, -0.2, -0.42), v, Vector3(0, 1, 0))


func push_pose() -> Transform3D:
	var v := Vector3(-0.9, 0.35, -0.25).normalized()
	return _blade_xf(Vector3(0.32, -0.12, -0.7), v, Vector3(0, 1, 0))


static func _ease_out(k: float) -> float:
	return 1.0 - pow(1.0 - k, 3.0)


static func _ease_in_out(k: float) -> float:
	return 4.0 * k * k * k if k < 0.5 else 1.0 - pow(-2.0 * k + 2.0, 3.0) / 2.0


# ===================================================================== hits

func camera_xform() -> Transform3D:
	var b := Basis.from_euler(Vector3(s.pitch, s.yaw, 0.0))
	return Transform3D(b, s.eye_pos())


func _sweep(th0: float, th1: float) -> void:
	if stopped or budget <= 0.0:
		return
	var cam := camera_xform()
	var length: float = ms["length"]
	var grip: float = ms["grip"]
	var reach_bonus := 0.35
	var steps: int = max(1, int(ceil(abs(th1 - th0) / (4.0 * DEG))))
	if atk.get("thrust", false):
		steps = 2
	for i in steps:
		var th: float = lerp(th0, th1, float(i + 1) / steps)
		var k: float = clamp(t / atk["strike"], 0.0, 1.0)
		var xf := cam * _attack_pose(th, k)
		var a: Vector3 = xf * Vector3(0, 0, -grip)
		var b: Vector3 = xf * Vector3(0, 0, -(grip + length + reach_bonus))
		for z in candidates:
			if not is_instance_valid(z) or z.is_dead() or hit_set.has(z):
				continue
			var base: Vector3 = z.global_position
			var top: float = z.collision_height() * (0.6 if z.rig and z.rig.pose == "sit" else 1.0)
			var r: float = z.collision_radius() + 0.18
			var pts := Geometry3D.get_closest_points_between_segments(a, b, base + Vector3(0, 0.15, 0), base + Vector3(0, top, 0))
			if pts[0].distance_to(pts[1]) < r:
				hit_set[z] = true
				var tangent: Vector3 = (xf.basis.x).normalized()
				_hit(z, pts[1], tangent, cam)
				if budget <= 0.0:
					_stop(z)
					return


func _hit(z, p: Vector3, tangent: Vector3, cam: Transform3D) -> void:
	var mass: float = HIT_MASS.get(z.kind, 2.0)
	budget -= mass
	var part: String = z.hit_part(p)
	var dmg: float = atk["damage"]
	# Damage falls off as the blade loses momentum through the crowd.
	var cleave_k: float = clamp(budget / max(atk["cleave"], 0.01) + 0.45, 0.45, 1.0)
	if part == "head":
		dmg *= 0.5  # head multiplier is applied by the target
	dmg *= cleave_k
	if atk.get("_full", false):
		dmg *= 1.25
	var force: float = atk["impact"] * (1.2 if atk.get("_full", false) else 1.0)
	z.impact_dir = (tangent + s.flat_forward() * 0.4).normalized()
	z.impact_force = force
	z.impact_point = p
	z.cut = _cut_type(z, p, part)
	z.take_damage(dmg, s, part, "melee", p)
	var killed: bool = z.is_dead()
	if killed:
		kills_this_swing += 1
	else:
		z.melee_stagger(z.impact_dir, force)
	# Feel: blade drags, camera punches with the swing, blood follows the edge.
	var heavy_target: bool = z.is_special
	drag_t = 0.07 if heavy_target else (0.045 if killed else 0.06)
	drag_scale = 0.06 if heavy_target else 0.18
	var local_t := cam.basis.inverse() * tangent
	cam_punch += Vector2(-local_t.y, -local_t.x) * (0.012 if not is_heavy else 0.02)
	Game.fx.blood_spray(p, z.impact_dir, 14 if killed else 8)
	if randf() < 0.5:
		Game.fx.blood_decal(z.global_position + z.impact_dir * randf_range(0.5, 1.5))
	if killed or randf() < 0.3:
		Game.fx.wall_blood(p, z.impact_dir)
	Game.sfx.play3d("slash" if killed else "chop", p, -2.0 if is_heavy else -4.0, 0.15)
	if killed and (z.cut != "" or is_heavy):
		Game.sfx.play3d("bone", p, -6.0, 0.2)
	blood = min(1.0, blood + 0.06)
	if s.controller and s.controller.has_method("hit_marker"):
		s.controller.hit_marker(killed, part == "head")
	if s.controller and s.controller.has_method("on_melee_hit"):
		s.controller.on_melee_hit(killed, z.global_position.distance_to(s.global_position))
	Game.make_noise(p, 8.0)


func _cut_type(z, p: Vector3, part: String) -> String:
	var dir: float = atk.get("dir", 0.0)
	var horizontal: bool = abs(sin(dir * DEG)) < 0.5
	var ly: float = p.y - z.global_position.y
	if atk.get("thrust", false):
		return ""
	if part == "head":
		return "split" if atk.get("split", false) or not horizontal else "decap"
	if horizontal and atk.get("bisect", false) and ly > 0.7 and ly < 1.35 and z.kind != "tank":
		return "bisect"
	if not horizontal and randf() < 0.45:
		return "arm"
	if horizontal and ly > 1.2 and randf() < 0.5:
		return "decap"
	return ""


func _stop(z) -> void:
	# Out of cleave: the blade stops in the body it couldn't get through.
	stopped = true
	drag_t = 0.12
	drag_scale = 0.0
	cam_punch += Vector2(0.03, 0.0)
	if z.kind == "tank" or z.kind == "charger" or z.kind == "witch":
		Game.sfx.play3d("clank", z.global_position + Vector3(0, 1.2, 0), -2.0)


## Ground slam: everything around the impact point is knocked flat.
func _slam(radius: float) -> void:
	atk["_slammed"] = true
	var cam := camera_xform()
	var p: Vector3 = cam * Vector3(0, -1.2, -1.6)
	p.y = s.global_position.y
	Game.fx.add_shake(p, 0.9)
	Game.fx.impact(p + Vector3(0, 0.05, 0), Vector3.UP)
	Game.fx.gib_burst(p + Vector3(0, 0.1, 0), Vector3.UP, 0.12)
	Game.sfx.play3d("tank_punch", p, 2.0, 0.1)
	cam_punch += Vector2(0.05, 0.0)
	for z in Game.infected.duplicate():
		if not is_instance_valid(z) or z.is_dead() or hit_set.has(z):
			continue
		var d: float = z.global_position.distance_to(p)
		if d < radius:
			var away: Vector3 = z.global_position - p
			away.y = 0
			away = away.normalized()
			if not z.is_special and d < radius * 0.5:
				z.impact_dir = (away + Vector3(0, 1.2, 0)).normalized()
				z.impact_force = 8.0
				z.take_damage(120.0, s, "body", "melee", z.global_position + Vector3(0, 0.8, 0))
			if not z.is_dead():
				z.melee_stagger(away, 10.0)


func _do_push() -> void:
	var p: Dictionary = ms["push"]
	var fwd: Vector3 = s.flat_forward()
	var n := 0
	for z in Game.infected.duplicate():
		if not is_instance_valid(z) or z.is_dead():
			continue
		var to: Vector3 = z.global_position - s.global_position
		to.y = 0
		var d := to.length()
		if d < p["range"] and d > 0.01 and fwd.dot(to / d) > p["arc"]:
			z.shove(s.global_position, s)
			n += 1
	# Push also knocks specials off teammates.
	for o in Game.survivors:
		if o == s or not is_instance_valid(o) or o.pinned_by == null:
			continue
		var to: Vector3 = o.global_position - s.global_position
		to.y = 0
		if to.length() < p["range"] and fwd.dot(to.normalized()) > 0.2:
			var pinner = o.pinned_by
			if is_instance_valid(pinner) and pinner.has_method("shoved_off"):
				pinner.shoved_off(s)
				n += 1
	cam_punch += Vector2(0.015, 0.0)
	if n > 0:
		Game.sfx.play3d("melee_hit", s.eye_pos() + fwd, -2.0, 0.15)
		if s.controller and s.controller.has_method("hit_marker"):
			s.controller.hit_marker(false, false)


## Called by Survivor.take_damage. Returns the damage that gets through.
func block_hit(amount: float, attacker, kind: String) -> float:
	if state != "block" or attacker == null or not is_instance_valid(attacker):
		return amount
	if not (kind in ["claw", "punch", "rock", "charge"]):
		return amount
	var to: Vector3 = attacker.global_position - s.global_position
	to.y = 0
	if to.length() > 0.01 and s.flat_forward().dot(to.normalized()) < ms["block_arc"]:
		return amount  # hit from behind or the side
	# Perfect block: raised just before the hit -> free, and the attacker reels.
	if t < 0.22 and kind != "rock":
		cam_punch += Vector2(0.03, randf_range(-0.015, 0.015))
		Game.sfx.play3d("clank", s.eye_pos() + s.flat_forward() * 0.6, 0.0, 0.05)
		Game.fx.impact(s.eye_pos() + s.flat_forward() * 0.7, -s.flat_forward())
		if attacker.has_method("melee_stagger"):
			attacker.melee_stagger(to.normalized(), 9.0)
		if s.controller and s.controller.has_method("on_perfect_block"):
			s.controller.on_perfect_block()
		return amount * (0.15 if kind == "punch" else 0.0)
	var cost: float = ms["block_cost"] * (4.0 if kind in ["punch", "rock"] else 1.0)
	_use_stamina(cost)
	cam_punch += Vector2(0.02, randf_range(-0.01, 0.01))
	Game.sfx.play3d("block", s.eye_pos() + s.flat_forward() * 0.6, -2.0, 0.1)
	if stamina < 0.0:
		stamina = 0.0
		_enter("idle")
		s.stun_t = 0.5
		Game.callout(s, "My guard's broken!")
		return amount * 0.5
	return amount * (0.25 if kind in ["punch", "rock"] else 0.0)
