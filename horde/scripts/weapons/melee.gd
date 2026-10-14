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
		"length": 1.18, "grip": 0.34, "pivot": Vector3(0.07, -0.27, -0.48),
		"halfsword": {"name": "Half-sword thrust", "thrust": true, "windup": 0.07, "strike": 0.1, "follow": 0.08, "recover": 0.3,
			"damage": 300.0, "cleave": 2.0, "impact": 9.0, "lunge": 3.5, "armor": 1.0, "sever": 0.3, "next_light": 0, "next_heavy": 0, "cost": 1.0},
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
	# Speed and precision: very fast light chain, weak cleave, heavy damage
	# and guaranteed severing on head hits (crits). The heavy is a lunge.
	"sabre": {
		"length": 0.84, "grip": 0.14, "pivot": Vector3(0.13, -0.24, -0.48),
		"stamina": 3.0, "block_cost": 0.7, "push_cost": 1.0, "block_arc": 0.35, "head_mult": 1.8, "crit": true, "swish_pitch": 1.3, "move": 1.06, "bite": 0.6,
		"parry": {"active": 0.28, "recover": 0.32, "cost": 0.5},
		"light": [
			{"name": "Cut 1", "dir": 28.0, "arc": [-56.0, 60.0], "windup": 0.07, "strike": 0.085, "follow": 0.06, "recover": 0.2,
				"damage": 105.0, "cleave": 1.6, "impact": 3.0, "lunge": 1.2, "sever": 0.45, "next_light": 1, "next_heavy": 0},
			{"name": "Cut 2", "dir": 152.0, "arc": [-56.0, 60.0], "windup": 0.07, "strike": 0.085, "follow": 0.06, "recover": 0.2,
				"damage": 105.0, "cleave": 1.6, "impact": 3.0, "lunge": 1.2, "sever": 0.45, "next_light": 2, "next_heavy": 0},
			{"name": "Rising cut", "dir": 300.0, "arc": [-54.0, 58.0], "windup": 0.08, "strike": 0.09, "follow": 0.06, "recover": 0.22,
				"damage": 115.0, "cleave": 1.6, "impact": 3.5, "lunge": 1.4, "sever": 0.5, "next_light": 3, "next_heavy": 0},
			{"name": "Snap cut", "dir": 80.0, "arc": [-54.0, 58.0], "windup": 0.08, "strike": 0.08, "follow": 0.06, "recover": 0.24,
				"damage": 130.0, "cleave": 1.2, "impact": 3.5, "lunge": 1.4, "sever": 0.6, "next_light": 0, "next_heavy": 0, "split": true},
		],
		"heavy": [
			{"name": "Lunge", "thrust": true, "windup": 0.05, "strike": 0.11, "follow": 0.08, "recover": 0.28, "charge": 0.3,
				"damage": 420.0, "cleave": 2.5, "impact": 8.0, "lunge": 7.5, "sever": 0.6, "next_light": 1, "next_heavy": 0},
		],
		"push": {"windup": 0.05, "active": 0.1, "recover": 0.22, "range": 2.2, "arc": 0.4, "force": 4.5},
		"push_attack": {"name": "Riposte", "thrust": true, "windup": 0.06, "strike": 0.09, "follow": 0.07, "recover": 0.24,
			"damage": 320.0, "cleave": 1.5, "impact": 6.0, "lunge": 4.0, "next_light": 0, "next_heavy": 0},
	},
	# Commitment: slow, wide and heavy. Every light is a crowd-cleaving sweep,
	# the charged heavy goes through a whole line and always cuts bodies in two.
	"executioner": {
		"length": 1.0, "grip": 0.36, "pivot": Vector3(0.06, -0.28, -0.5), "swift_exec": 2.0,
		"stamina": 5.0, "block_cost": 0.4, "push_cost": 1.2, "block_arc": 0.2, "speed": 0.92, "swish_pitch": 0.72, "move": 0.9, "bite": 1.45,
		"light": [
			{"name": "Wide sweep L>R", "dir": 8.0, "arc": [-70.0, 76.0], "windup": 0.26, "strike": 0.19, "follow": 0.16, "recover": 0.46,
				"damage": 230.0, "cleave": 7.0, "impact": 9.0, "lunge": 2.4, "sever": 0.85, "next_light": 1, "next_heavy": 0, "bisect": true},
			{"name": "Wide sweep R>L", "dir": 172.0, "arc": [-70.0, 76.0], "windup": 0.24, "strike": 0.19, "follow": 0.16, "recover": 0.46,
				"damage": 230.0, "cleave": 7.0, "impact": 9.0, "lunge": 2.4, "sever": 0.85, "next_light": 0, "next_heavy": 0, "bisect": true},
		],
		"heavy": [
			{"name": "Headsman", "dir": 90.0, "arc": [-60.0, 62.0], "windup": 0.1, "strike": 0.15, "follow": 0.14, "recover": 0.55,
				"damage": 900.0, "cleave": 3.0, "impact": 12.0, "lunge": 2.8, "charge": 0.85, "sever": 1.2, "next_light": 0, "next_heavy": 1, "split": true},
			{"name": "Reaping sweep", "dir": 4.0, "arc": [-80.0, 84.0], "windup": 0.1, "strike": 0.22, "follow": 0.18, "recover": 0.55,
				"damage": 420.0, "cleave": 30.0, "impact": 13.0, "lunge": 3.6, "charge": 0.8, "sever": 1.2, "next_light": 1, "next_heavy": 0, "bisect": true},
		],
		"push": {"windup": 0.07, "active": 0.12, "recover": 0.34, "range": 2.8, "arc": 0.3, "force": 7.5},
		"push_attack": {"name": "Pommel strike", "thrust": true, "windup": 0.1, "strike": 0.12, "follow": 0.1, "recover": 0.38,
			"damage": 200.0, "cleave": 3.0, "impact": 11.0, "lunge": 2.5, "next_light": 0, "next_heavy": 0},
	},
	# Momentum: the swings get faster with every consecutive hit (up to +40%);
	# whiffing or pausing loses it. Rewards staying in the crowd.
	"messer": {
		"length": 0.76, "grip": 0.19, "pivot": Vector3(0.12, -0.25, -0.48), "momentum": true, "swish_pitch": 1.1, "bite": 0.85,
		"wrath": {"name": "Wrath cut", "dir": 35.0, "arc": [-64.0, 70.0], "windup": 0.1, "strike": 0.13, "follow": 0.1, "recover": 0.36,
			"damage": 220.0, "cleave": 4.0, "impact": 8.0, "lunge": 3.0, "sever": 0.7, "next_light": 0, "next_heavy": 0, "bisect": true},
		"stamina": 3.5, "block_cost": 0.6, "push_cost": 1.0, "block_arc": 0.3,
		"light": [
			{"name": "Zornhau", "dir": 38.0, "arc": [-58.0, 62.0], "windup": 0.11, "strike": 0.11, "follow": 0.08, "recover": 0.28,
				"damage": 140.0, "cleave": 2.6, "impact": 4.5, "lunge": 1.4, "sever": 0.55, "next_light": 1, "next_heavy": 0},
			{"name": "Back cut", "dir": 150.0, "arc": [-58.0, 62.0], "windup": 0.1, "strike": 0.11, "follow": 0.08, "recover": 0.28,
				"damage": 140.0, "cleave": 2.6, "impact": 4.5, "lunge": 1.4, "sever": 0.55, "next_light": 2, "next_heavy": 0},
			{"name": "Low sweep", "dir": 10.0, "arc": [-60.0, 64.0], "windup": 0.1, "strike": 0.12, "follow": 0.08, "recover": 0.28,
				"damage": 130.0, "cleave": 3.2, "impact": 4.0, "lunge": 1.4, "sever": 0.6, "next_light": 3, "next_heavy": 0},
			{"name": "Rising back cut", "dir": 215.0, "arc": [-58.0, 62.0], "windup": 0.1, "strike": 0.11, "follow": 0.08, "recover": 0.28,
				"damage": 140.0, "cleave": 2.6, "impact": 4.5, "lunge": 1.4, "sever": 0.55, "next_light": 0, "next_heavy": 0},
		],
		"heavy": [
			{"name": "Crown cut", "dir": 85.0, "arc": [-58.0, 60.0], "windup": 0.07, "strike": 0.12, "follow": 0.1, "recover": 0.34,
				"damage": 340.0, "cleave": 2.0, "impact": 7.0, "lunge": 2.2, "charge": 0.4, "sever": 0.8, "next_light": 1, "next_heavy": 0, "split": true},
		],
		"push": {"windup": 0.05, "active": 0.1, "recover": 0.26, "range": 2.4, "arc": 0.38, "force": 5.5},
		"push_attack": {"name": "Nagel jab", "thrust": true, "windup": 0.07, "strike": 0.1, "follow": 0.08, "recover": 0.28,
			"damage": 220.0, "cleave": 2.0, "impact": 6.0, "lunge": 3.5, "next_light": 0, "next_heavy": 0},
	},
	# Bearded axe — hew. Commits to whoever's in front: every swing bites into
	# the body it stops in and rips free in a gout of blood. Fast alternating
	# chops, a skull-splitting overhead, a sweep that takes the legs out, and
	# the beard hook (special) that drags a zombie down at your feet, where
	# the axe does double damage.
	"fire_axe": {
		"length": 0.6, "grip": 0.4, "pivot": Vector3(0.1, -0.26, -0.48), "head_mass": true,
		"stamina": 3.0, "block_cost": 0.6, "push_cost": 1.0, "block_arc": 0.3,
		"bite": 1.3, "embed": true, "view_roll": 0.55, "downed_mult": 2.0, "swish_pitch": 0.85,
		"idle_o": Vector3(0.3, -0.34, -0.5), "idle_v": Vector3(0.1, 0.8, -0.55),
		"light": [
			{"name": "Hew L", "dir": 55.0, "arc": [-58.0, 56.0], "windup": 0.13, "strike": 0.1, "follow": 0.08, "recover": 0.26,
				"damage": 230.0, "cleave": 1.3, "impact": 6.5, "lunge": 1.3, "sever": 0.75, "next_light": 1, "next_heavy": 0, "split": true},
			{"name": "Hew R", "dir": 125.0, "arc": [-58.0, 56.0], "windup": 0.13, "strike": 0.1, "follow": 0.08, "recover": 0.26,
				"damage": 230.0, "cleave": 1.3, "impact": 6.5, "lunge": 1.3, "sever": 0.75, "next_light": 2, "next_heavy": 1, "split": true},
			{"name": "Low hew", "dir": 16.0, "arc": [-60.0, 60.0], "windup": 0.14, "strike": 0.11, "follow": 0.08, "recover": 0.28,
				"damage": 200.0, "cleave": 1.8, "impact": 6.0, "lunge": 1.4, "sever": 0.9, "next_light": 0, "next_heavy": 1},
		],
		"heavy": [
			{"name": "Skullsplitter", "dir": 90.0, "arc": [-60.0, 62.0], "windup": 0.06, "strike": 0.12, "follow": 0.12, "recover": 0.38,
				"damage": 520.0, "cleave": 1.2, "impact": 10.0, "lunge": 2.6, "charge": 0.45, "sever": 0.9, "next_light": 0, "next_heavy": 1, "split": true},
			{"name": "Bearded sweep", "dir": 172.0, "arc": [-64.0, 66.0], "windup": 0.07, "strike": 0.17, "follow": 0.12, "recover": 0.4,
				"damage": 260.0, "cleave": 5.0, "impact": 9.0, "lunge": 2.6, "charge": 0.5, "sever": 0.6, "next_light": 1, "next_heavy": 0, "trip": true},
		],
		"hook": {"name": "Beard hook", "dir": 176.0, "arc": [-52.0, 46.0], "windup": 0.07, "strike": 0.12, "follow": 0.08, "recover": 0.28,
			"damage": 8.0, "cleave": 5.0, "impact": 3.0, "lunge": 2.2, "sever": 0.0, "hook": true, "cost": 1.0, "next_light": 0, "next_heavy": 0},
		"push": {"windup": 0.05, "active": 0.1, "recover": 0.28, "range": 2.4, "arc": 0.38, "force": 5.5},
		"push_attack": {"name": "Haft jab", "thrust": true, "windup": 0.07, "strike": 0.1, "follow": 0.08, "recover": 0.28,
			"damage": 160.0, "cleave": 2.0, "impact": 8.0, "lunge": 3.0, "next_light": 0, "next_heavy": 0},
	},
	"sledgehammer": {
		"length": 0.72, "grip": 0.6, "pivot": Vector3(0.07, -0.28, -0.48), "head_mass": true, "swish_pitch": 0.65,
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
		"length": 0.52, "grip": 0.14, "pivot": Vector3(0.14, -0.24, -0.48),
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
const HIT_MASS := {"shieldbearer": 6.0, "rager": 2.0, "common": 1.0, "boomer": 1.5, "spitter": 2.0, "hunter": 2.5, "smoker": 2.5, "charger": 4.0, "witch": 6.0, "tank": 99.0}

var s                       # Survivor
var momentum := 0           # consecutive-hit stacks (momentum weapons)
var cam_roll := 0.0         # kill roll kick, decays
var _drip_t := 0.0
var corpses: Array = []     # ragdolls near this swing
var corpse_hit := {}
var swing_hits := 0
var crit_flash := 0.0
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
var _last_hit_p := Vector3.INF
var _embed_p := Vector3.INF
var _embed_dir := Vector3.FORWARD
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
	momentum = 0
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
	var w: float = ms.get("move", 1.0)
	match state:
		"charge": return 0.6 * w
		"block": return 0.65 * w
		"strike", "follow": return 0.85 * w
	return w


# ===================================================================== update

func update(delta: float, fire_held: bool, block_held: bool) -> void:
	var fire_pressed := fire_held and not _fire_prev
	_fire_prev = fire_held
	cam_punch = cam_punch.lerp(Vector2.ZERO, min(1.0, delta * 14.0))
	cam_roll = lerpf(cam_roll, 0.0, minf(1.0, delta * 10.0))
	# A bloody blade drips; it slowly runs clean between fights.
	if blood > 0.12 and state in ["idle", "block", "recover"]:
		_drip_t -= delta
		if _drip_t <= 0.0:
			_drip_t = randf_range(0.25, 0.7) / blood
			var tip: Vector3 = camera_xform() * pose * Vector3(0, 0, -ms.get("grip", 0.3) - ms.get("length", 1.0) * randf_range(0.3, 0.95))
			Game.fx.drip(tip)
	blood = maxf(0.0, blood - delta * 0.004)
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
		if drag_t <= 0.0 and _embed_p != Vector3.INF:
			_rip()
	dt *= tempo()
	# How long the *current* press has been held (mashing never adds up
	# to a heavy).
	if fire_held:
		press_t += delta
	else:
		press_t = 0.0
	lunge = Vector3.ZERO
	_update_view_roll(delta)
	var vis_to := 0.0
	match state:
		"strike", "follow": vis_to = 1.0
		"windup": vis_to = 0.6
		"charge": vis_to = 0.3
	_swing_vis = move_toward(_swing_vis, vis_to, delta * (9.0 if vis_to > _swing_vis else 4.0))
	# The body leans into the cut: the view rolls and turns with a sweep
	# and nods with an overhead, then settles.
	var lean_to := Vector3.ZERO
	if state in ["strike", "follow", "windup", "charge"] and atk.has("dir") and not atk.get("thrust", false):
		var a: float = float(atk["dir"]) * DEG
		var env := 0.0
		match state:
			"windup": env = -0.35 * clampf(t / maxf(atk["windup"], 0.01), 0.0, 1.0)
			"charge": env = -0.45
			"strike": env = sin(clampf(t / maxf(atk["strike"], 0.01), 0.0, 1.0) * PI * 0.5) * 1.0
			"follow": env = 1.0 - clampf(t / maxf(atk["follow"], 0.01), 0.0, 1.0) * 0.5
		var amt: float = (1.6 if is_heavy else 1.0) * float(ms.get("lean", 1.0))
		lean_to = Vector3(-sin(a) * 0.022, -cos(a) * 0.016, -cos(a) * 0.03) * env * amt
	swing_lean = swing_lean.lerp(lean_to, minf(1.0, delta * (16.0 if lean_to.length() > swing_lean.length() else 7.0)))

	match state:
		"idle":
			idle_t += delta
			if idle_t > 0.7:
				light_i = 0
				heavy_i = 0
				momentum = 0
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
		"parry":
			t += dt
			var pr: Dictionary = ms["parry"]
			pose = _pose_from.interpolate_with(parry_pose(), _ease_out(clampf(t / 0.06, 0.0, 1.0)))
			if t >= pr["active"]:
				pose = pose.interpolate_with(idle_pose(), min(1.0, delta * 6.0))
			if t >= pr["active"] + pr["recover"]:
				_enter("idle")
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


## Weapon special (V / middle mouse). Sabre: parry — a short window that
## deflects any melee hit from the front, reels the attacker and opens a
## riposte; mistimed, it leaves you open for a moment.
func special() -> void:
	if ms.has("wrath") and momentum >= 2 and state in ["idle", "recover", "follow"]:
		# Messer: spend the momentum on one huge cut.
		atk = ms["wrath"].duplicate()
		atk["damage"] *= 1.0 + 0.25 * momentum
		atk["cleave"] += momentum
		atk["sever"] += 0.15 * momentum
		momentum = 0
		swing_hits = 0
		is_heavy = true
		stopped = false
		press_t = 0.0
		queued = false
		_enter("windup")
		Game.sfx.play3d("whoosh_heavy", s.eye_pos(), 0.0, 0.05, 0.9)
		if s.controller and s.controller.has_method("on_full_charge"):
			s.controller.on_full_charge()
		return
	if ms.has("hook") and state in ["idle", "block", "recover", "follow"] and stamina >= 0.5:
		# Axe: hook the beard round a leg or neck and drag them down.
		_use_stamina(ms["hook"]["cost"])
		atk = ms["hook"]
		is_heavy = false
		stopped = false
		swing_hits = 0
		press_t = 0.0
		queued = false
		_enter("windup")
		Game.sfx.play3d("whoosh", s.eye_pos(), -6.0, 0.05, 0.8)
		return
	if ms.has("halfsword") and state in ["idle", "block", "recover", "follow"] and stamina >= 0.5:
		# Greatsword: grip the blade and stab through armour.
		_use_stamina(ms["halfsword"]["cost"])
		atk = ms["halfsword"]
		is_heavy = true
		stopped = false
		press_t = 0.0
		queued = false
		_enter("windup")
		Game.sfx.play3d("blade_ring", s.eye_pos(), -10.0, 0.05, 1.3)
		return
	if ms.has("swift_exec") and state in ["idle", "recover", "follow"] and stamina >= ms["swift_exec"]:
		# Executioner: skip the charge, full-power Headsman right now.
		_use_stamina(ms["swift_exec"])
		atk = ms["heavy"][0].duplicate()
		atk["_full"] = true
		is_heavy = true
		stopped = false
		press_t = 0.0
		queued = false
		_pose_from = pose
		_begin_strike()
		Game.sfx.play3d("whoosh_heavy", s.eye_pos(), 0.0, 0.05, 0.7)
		if s.controller and s.controller.has_method("on_full_charge"):
			s.controller.on_full_charge()
		return
	if not ms.has("parry") or state not in ["idle", "block", "recover"] or stamina <= 0.0:
		return
	_use_stamina(ms["parry"]["cost"])
	_enter("parry")
	Game.sfx.play3d("whoosh", s.eye_pos(), -8.0, 0.1, 1.4)


func parry_pose() -> Transform3D:
	var v := Vector3(-0.85, 0.45, -0.3).normalized()
	return _blade_xf(Vector3(0.24, -0.16, -0.46), v, Vector3(0, 1, 0.2).normalized())


func _enter(st: String) -> void:
	if state == "strike" and st != "strike" and kills_this_swing >= 3:
		# One swing through a crowd.
		if s.controller and s.controller.has_method("on_multi_kill"):
			s.controller.on_multi_kill(kills_this_swing)
	state = st
	t = 0.0
	_pose_from = pose
	if st == "idle":
		idle_t = 0.0
	if st == "recover":
		queued = false


## Swing speed: the weapon's own pace, plus momentum (messer).
func tempo() -> float:
	return ms.get("speed", 1.0) * (1.0 + 0.08 * momentum)


func _start_attack(chained: bool) -> void:
	if ms.get("momentum", false) and atk.size() > 0:
		if swing_hits > 0:
			momentum = mini(momentum + 1, 5)
			if momentum == 5 and s.controller and s.controller.has_method("on_full_charge"):
				s.controller.on_full_charge()
		else:
			momentum = maxi(momentum - 2, 0)
	swing_hits = 0
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
	corpses.clear()
	corpse_hit.clear()
	for r in SkinnedRig.ragdolls:
		if is_instance_valid(r) and r.sim and is_instance_valid(r.sim) and r.global_position.distance_to(eye) < 4.0:
			corpses.append(r)
	theta = _strike_theta(0.0)
	theta_prev = theta
	_enter("strike")
	# Lighter blades hiss higher, big ones whoom lower; faster swings rise.
	var pitch: float = ms.get("swish_pitch", 1.0) * (0.9 + 0.1 * tempo())
	Game.sfx.play3d("whoosh_heavy" if is_heavy else "whoosh", s.eye_pos(), -1.0 if is_heavy else -4.0, 0.12, pitch)
	if is_heavy and ms.get("length", 0.0) > 0.9:
		Game.sfx.play3d("blade_ring", s.eye_pos(), -12.0, 0.08)
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
	var o: Vector3 = piv + S * 0.22 * sin(th) + F * 0.04 + U * 0.08 + Vector3(0, 0.02, 0.02 if charged else -0.01)
	return _blade_xf(o, v, tangent)


## How the blade is *drawn*. Hit detection uses `pose` as-is; the viewmodel
## pulls the grip low and close (hands at or below the screen edge, like
## Darktide/Vermintide) and flattens the blade toward the screen plane so
## swings sweep big across the frame instead of stabbing away from you.
const VIEW_DROP := 0.11        # grip lowered (m)
const VIEW_NEAR := 0.7         # grip distance scale (closer to the eye)
const VIEW_FLAT := 0.6         # blade depth component scale
const VIEW_HALF_W := 0.9       # tan(half hfov) at the default 85 deg FOV, 16:9
const VIEW_HALF_H := 0.52
const VIEW_MIN_DEPTH := 0.42   # hands stay at least this far from the eye
const VIEW_EDGE := 1.0         # upper fist centred on the frame edge (half visible)
const VIEW_EDGE_SWING := 0.72  # ...and well into frame mid-swing
const VIEW_FLAT_SWING := 0.4
var _swing_vis := 0.0          # 0 at rest, 1 through the strike (eased)
var swing_lean := Vector3.ZERO # camera pitch / yaw / roll following the cut
const VIEW_MAX_DROP := 0.45

func view_pose(xf: Transform3D) -> Transform3D:
	var o := xf.origin
	o = Vector3(o.x * 1.05, o.y - VIEW_DROP, o.z * VIEW_NEAR)
	var d := -xf.basis.z
	# Ends of the arc are pulled in toward the middle of the screen, so a
	# follow-through finishes in a bottom corner instead of off frame.
	d = d.lerp(Vector3(0, 0.4, -1).normalized(), 0.32 * _swing_vis).normalized()
	o.x *= 1.0 - 0.25 * _swing_vis
	# Mid-swing the arc flattens toward the screen and the hands come up
	# into frame, so the cut crosses the middle of the view.
	d = Vector3(d.x, d.y, d.z * lerpf(VIEW_FLAT, VIEW_FLAT_SWING, _swing_vis)).normalized()
	var edge := lerpf(VIEW_EDGE, VIEW_EDGE_SWING, _swing_vis)
	var g: float = ms.get("grip", 0.3)
	# Never let a fist come right up to the lens.
	for frac in [0.8, 0.2]:
		var hz: float = (o + d * g * frac).z
		if -hz < VIEW_MIN_DEPTH:
			o.z -= VIEW_MIN_DEPTH + hz
	# Drop the weapon until the upper fist sits on the bottom edge of the
	# frame (half cut off, like Darktide); a fist already off the side
	# edge doesn't need it. The blade, much longer, stays in view.
	var drop := 0.0
	for frac in [0.8, 0.2]:
		var hand: Vector3 = o + d * g * frac
		var depth := maxf(-hand.z, 0.12)
		if absf(hand.x) / depth > VIEW_HALF_W * edge:
			continue
		drop = maxf(drop, hand.y + VIEW_HALF_H * edge * depth)
	o.y -= minf(drop, VIEW_MAX_DROP)
	var out := _blade_xf(o, d, xf.basis.x)
	# Axe and hammer heads twist round the haft toward the camera so they
	# read as shapes instead of edge-on slivers (see _update_view_roll).
	if _view_roll != 0.0:
		out.basis = out.basis * Basis(Vector3(0, 0, 1), _view_roll)
	return out


var _view_roll := 0.0

## Roll the drawn head about the haft until its face shows: the angle that
## turns the edge direction across the view, nearest the weapon's resting
## twist, eased in over ~0.1 s so it reads as a turn of the wrist.
func _update_view_roll(delta: float) -> void:
	var base: float = ms.get("view_roll", 0.0)
	var max_twist: float = ms.get("view_twist", 1.3 if base != 0.0 else 0.75)
	var keep := _view_roll
	_view_roll = 0.0
	var b := view_pose(pose).basis
	_view_roll = keep
	var A: float = b.x.z
	var B: float = b.y.z
	var target := base
	var e_base: float = absf(A * cos(base) + B * sin(base))
	if e_base > 0.35:
		var phi := atan2(B, A)
		var r1 := wrapf(phi + PI / 2.0, base - PI, base + PI)
		var r2 := wrapf(phi - PI / 2.0, base - PI, base + PI)
		var root := r1 if absf(r1 - base) < absf(r2 - base) else r2
		var w := smoothstep(0.35, 0.85, e_base)
		target = base + clampf(root - base, -max_twist, max_twist) * w
	_view_roll = lerp_angle(_view_roll, target, minf(1.0, delta * 14.0))


func idle_pose() -> Transform3D:
	# Low and out to the right, blade angled up and across the screen.
	# Short heavy-headed weapons rest on the right instead, head clear of
	# the crosshair.
	if ms.has("idle_v"):
		return _blade_xf(ms["idle_o"], (ms["idle_v"] as Vector3).normalized(), Vector3(-1, -0.1, 0.25).normalized())
	var v := Vector3(-0.22, 0.78, -0.58).normalized()
	return _blade_xf(Vector3(0.2, -0.36, -0.52), v, Vector3(-1, -0.1, 0.25).normalized())


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
		_sweep_corpses(a, b, xf)


## Bodies on the ground get cut too: shove the bone the blade passes
## through and sometimes take the limb off. Costs a little cleave.
func _sweep_corpses(a: Vector3, b: Vector3, xf: Transform3D) -> void:
	for r in corpses:
		if not is_instance_valid(r) or corpse_hit.has(r) or r.sim == null or not is_instance_valid(r.sim):
			continue
		for pb in r.sim.get_children():
			if not pb is PhysicalBone3D:
				continue
			var c: Vector3 = (pb as PhysicalBone3D).global_position
			var q := Geometry3D.get_closest_point_to_segment(c, a, b)
			if q.distance_to(c) < 0.16:
				corpse_hit[r] = true
				var tangent: Vector3 = xf.basis.x.normalized()
				var cut: bool = r.chop_corpse(pb, (tangent * 5.0 + Vector3(0, 2.0, 0)) * (1.5 if is_heavy else 1.0), atk.get("sever", 0.5) * (1.3 if is_heavy else 0.9))
				Game.fx.blood_spray(q, tangent, 10 if cut else 5)
				Game.sfx.play3d("flesh_hit", q, -6.0 if cut else -10.0, 0.15)
				if cut:
					Game.sfx.play3d("gore", q, -6.0, 0.15)
				budget -= 0.25
				blood = min(1.0, blood + 0.02)
				break


func _hit(z, p: Vector3, tangent: Vector3, cam: Transform3D) -> void:
	var mass: float = HIT_MASS.get(z.kind, 2.0)
	budget -= mass
	var part: String = z.hit_part(p)
	var dmg: float = atk["damage"]
	swing_hits += 1
	var crit := false
	var riposte: bool = s.riposte_t > 0.0
	if riposte:
		# Counter after a perfect dodge: hits like a heavy and always severs.
		s.riposte_t = 0.0
		dmg *= 1.7
		crit = true
	if part == "head":
		dmg *= ms.get("head_mult", 1.0)
		crit = ms.get("crit", false)
	# Damage falls off as the blade loses momentum through the crowd.
	var cleave_k: float = clamp(budget / max(atk["cleave"], 0.01) + 0.45, 0.45, 1.0)
	if part == "head":
		dmg *= 0.5  # head multiplier is applied by the target
	dmg *= cleave_k
	if atk.get("_full", false):
		dmg *= 1.25
	var downed: bool = z.has_method("is_downed") and z.is_downed()
	if downed:
		dmg *= ms.get("downed_mult", 1.0)
	_last_hit_p = p
	# Armor (Darktide "carapace"-lite): sweeps glance off, strikedowns go through.
	var armored: bool = z.has_method("is_armored") and z.is_armored()
	if armored:
		var pierce: float = atk.get("armor", 0.25)
		if atk.get("thrust", false) or atk.get("split", false) or atk.has("slam"):
			pierce = max(pierce, 1.0)
		if ms.get("head_mass", false):
			pierce = max(pierce, 0.8)
		dmg *= pierce
		if pierce < 0.5:
			budget = 0.0
			Game.sfx.play3d("clank", p, -2.0, 0.1)
			Game.fx.impact(p, -tangent)
	var force: float = atk["impact"] * (1.2 if atk.get("_full", false) else 1.0)
	z.impact_dir = (tangent + s.flat_forward() * 0.4).normalized()
	z.impact_force = force
	z.impact_point = p
	z.cut = _cut_type(z, p, part)
	if crit and z.hp - dmg <= 0.0 and z.kind != "tank":
		# Precision kill: the head always comes off, with a bright ring.
		z.cut = "decap" if abs(sin(atk.get("dir", 0.0) * DEG)) < 0.6 else "split"
		Game.sfx.play3d("blade_ring", p, -2.0, 0.05)
		crit_flash = 0.12
		if s.controller and s.controller.has_method("on_crit"):
			s.controller.on_crit()
	if Game.autotest and OS.has_environment("CUT_LOG"):
		print("[cutlog] %s heavy=%s ly=%.2f part=%s cut=%s" % [atk.get("name", "?"), is_heavy, p.y - z.global_position.y, part, z.cut])
	z.take_damage(dmg, s, part, "melee", p)
	var killed: bool = z.is_dead()
	if killed:
		kills_this_swing += 1
	else:
		if atk.get("hook", false):
			# Dragged off their feet toward you.
			var to_me: Vector3 = s.global_position - z.global_position
			z.knockdown(to_me, randf_range(1.3, 1.8))
			Game.sfx.play3d("thump", p, -4.0, 0.1, 0.8)
		elif atk.get("trip", false):
			z.knockdown(tangent, randf_range(1.0, 1.5))
		else:
			z.melee_stagger(z.impact_dir, force)
		if z.cut == "arm" and z.has_method("maim"):
			z.maim("arm", z.impact_dir * force)
		z.cut = ""
	# Feel: blade drags, camera punches with the swing, blood follows the edge.
	var heavy_target: bool = z.is_special
	# Hit drag: how long and how hard the blade bites, per weapon weight.
	var bite: float = ms.get("bite", 1.0)
	drag_t = (0.07 if heavy_target else (0.045 if killed else 0.06)) * bite * (1.2 if is_heavy else 1.0)
	drag_scale = clampf((0.06 if heavy_target else 0.18) / bite, 0.03, 0.4)
	var local_t := cam.basis.inverse() * tangent
	cam_punch += Vector2(-local_t.y, -local_t.x) * (0.012 if not is_heavy else 0.02)
	Game.fx.blood_spray(p, z.impact_dir, 14 if killed else 8)
	Game.fx.slash_mark(p, tangent, 0.45 if is_heavy else 0.32, is_heavy)
	if killed:
		cam_roll += (0.018 if is_heavy else 0.01) * signf((cam.basis.inverse() * tangent).x)
	if randf() < 0.5:
		Game.fx.blood_decal(z.global_position + z.impact_dir * randf_range(0.5, 1.5))
	if killed or randf() < 0.3:
		Game.fx.wall_blood(p, z.impact_dir)
	# Layered hit: a wet flesh impact on everything struck (quieter as the
	# blade cleaves on), body weight under the first, gore on kills.
	var first: bool = hit_set.size() <= 1
	Game.sfx.play3d("flesh_hit", p, (0.0 if is_heavy else -2.0) - (0.0 if first else 4.0), 0.1)
	if first:
		Game.sfx.play3d("thump", p, -3.0 if is_heavy else -8.0, 0.1)
	if killed:
		Game.sfx.play3d("gore", p, -3.0 if z.cut != "" else -8.0, 0.15)
		if z.cut != "" or is_heavy:
			Game.sfx.play3d("splat", p, -2.0 if z.cut != "" else -6.0, 0.1)
	blood = min(1.0, blood + 0.06)
	if s.controller and s.controller.has_method("hit_marker"):
		s.controller.hit_marker(killed, part == "head")
	if s.controller and s.controller.has_method("on_melee_hit"):
		s.controller.on_melee_hit(killed, z.global_position.distance_to(s.global_position))
	Game.make_noise(p, 8.0)


func _cut_type(z, p: Vector3, part: String) -> String:
	if atk.get("thrust", false):
		return ""
	var dir: float = atk.get("dir", 0.0)
	var horizontal: bool = abs(sin(dir * DEG)) < 0.5
	var sc: float = z.rig.model_scale if z.rig is SkinnedRig else 1.0
	var ly: float = (p.y - z.global_position.y) / maxf(sc, 0.5)
	var power: float = atk.get("sever", 0.5)        # weapon/attack's cutting power
	if is_heavy:
		power += 0.35
	if atk.get("_full", false):
		power += 0.2
	if z.kind == "tank" or z.kind == "charger":
		power -= 0.8
	# A full-power vertical blow splits the whole body down the middle.
	if not horizontal and atk.get("split", false) and power >= 1.2 and ly > 0.9:
		return "vsplit"
	if part == "head":
		if horizontal:
			return "decap" if randf() < power + 0.3 else ""
		var r := randf()
		return "split" if r < 0.5 + power * 0.3 else ("decap" if r < 0.85 else "")
	if horizontal:
		# A sweep strong enough to bisect goes clean through the trunk.
		if atk.get("bisect", false) and power >= 0.75 and ly > 0.6:
			return "waist"
		if ly > 1.32:
			return "decap" if randf() < power + 0.2 else ""
		if ly < 0.7:
			return "leg" if randf() < power * 0.8 else ""
		return "arm" if randf() < power * 0.4 else ""
	# Diagonals and overheads lop arms; full-power overheads split the skull.
	if ly > 1.25 and atk.get("split", false):
		return "split"
	return "arm" if randf() < power * 0.7 else ""


func _stop(z) -> void:
	# Out of cleave: the blade stops in the body it couldn't get through.
	stopped = true
	drag_t = 0.12
	drag_scale = 0.0
	cam_punch += Vector2(0.03, 0.0)
	if ms.get("embed", false) and not atk.get("hook", false) and _last_hit_p != Vector3.INF:
		# The axe buries itself: a beat stuck in the body, then wrenched out.
		drag_t = 0.15 if not is_heavy else 0.2
		_embed_p = _last_hit_p
		_embed_dir = s.flat_forward()
		Game.sfx.play3d("thump", _embed_p, -2.0, 0.08, 0.75)
		cam_punch += Vector2(0.015, 0.0)
	if z.kind == "tank" or z.kind == "charger" or z.kind == "witch":
		Game.sfx.play3d("clank", z.global_position + Vector3(0, 1.2, 0), -2.0)


## Wrench a buried axe free: blood follows it out toward you.
func _rip() -> void:
	var p := _embed_p
	_embed_p = Vector3.INF
	var back := (-_embed_dir + Vector3(0, 0.6, 0)).normalized()
	Game.fx.blood_spray(p, back, 16)
	Game.fx.blood_mist(p, back, 0.45)
	Game.sfx.play3d("splat", p, -4.0, 0.12, 0.9)
	Game.sfx.play3d("flesh_hit", p, -8.0, 0.15, 0.7)
	cam_punch += Vector2(-0.02, randf_range(-0.01, 0.01))
	blood = minf(1.0, blood + 0.05)
	if (s.eye_pos() - p).length() < 1.6 and randf() < 0.3 and Game.hud:
		Game.hud.screen_blood()


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
				z.knockdown(away, randf_range(0.8, 1.6))


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
			var force: float = p.get("force", 5.0)
			# Heavy weapons bowl over whoever's right in your face.
			if force >= 7.0 and d < 1.3 and z.kind == "common":
				z.knockdown(to / d, randf_range(0.6, 1.1))
			else:
				z.shove(s.global_position, s)
			z.rig.hit_react(to / d, force * 0.8)
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
		Game.sfx.play3d("thump", s.eye_pos() + fwd, -1.0 + minf(n, 4) * 0.8, 0.12, 0.85)
		Game.sfx.play3d("flesh_hit", s.eye_pos() + fwd, -6.0, 0.15)
		cam_punch += Vector2(0.012 + 0.004 * minf(n, 4), randf_range(-0.01, 0.01))
		drag_t = 0.05
		drag_scale = 0.2
		if s.controller and s.controller.has_method("hit_marker"):
			s.controller.hit_marker(false, false)


## Called by Survivor.take_damage. Returns the damage that gets through.
func block_hit(amount: float, attacker, kind: String) -> float:
	if state == "parry" and t < ms["parry"]["active"] and attacker and is_instance_valid(attacker) and kind in ["claw", "punch"]:
		var to: Vector3 = attacker.global_position - s.global_position
		to.y = 0
		if to.length() < 0.01 or s.flat_forward().dot(to.normalized()) > 0.2:
			# Clean parry.
			Game.sfx.play3d("clank", s.eye_pos() + s.flat_forward() * 0.6, 2.0, 0.05)
			Game.sfx.play3d("blade_ring", s.eye_pos() + s.flat_forward() * 0.6, -2.0, 0.05, 1.2)
			Game.fx.impact(s.eye_pos() + s.flat_forward() * 0.6, -s.flat_forward())
			cam_punch += Vector2(0.03, randf_range(-0.02, 0.02))
			if attacker.has_method("melee_stagger"):
				attacker.melee_stagger(to.normalized(), 12.0)
			s.riposte_t = 1.0
			if s.controller and s.controller.has_method("on_perfect_dodge"):
				s.controller.on_perfect_dodge(attacker)
			return 0.0
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
