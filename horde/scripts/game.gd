extends Node
## Global state and shared references (autoload "Game").
##
## Everything that several systems need to reach (the level, director, sound,
## effects, HUD, the survivor and infected lists) hangs off this node.

## Bump on every pushed change so a running build can be identified.
const VERSION := "0.14.3 — bone cracks, weapon draw"

enum Diff { EASY, NORMAL, ADVANCED, EXPERT }
const DIFF_NAMES := ["Easy", "Normal", "Advanced", "Expert"]
const MAPS := 3
const MAP_NAMES := ["Part 1: The Blackout", "Part 2: The Warehouse District", "Part 3: Last Broadcast"]

# Physics layers
const LAYER_WORLD := 1
const LAYER_SURVIVOR := 2
const LAYER_INFECTED := 4
const LAYER_PROJECTILE := 8

var difficulty: int = Diff.NORMAL
var main: Node = null
var world: Node3D = null
var level = null
var director = null
var sfx = null
var fx = null
var hud = null
var player = null
var survivors: Array = []
var infected: Array = []
var usables: Array = []
var hazards: Array = []
var attractors: Array = []
var map_index := 0
var autotest := false
var autotest_seconds := 90.0
var mode := "campaign"        # "campaign" or "sandbox" (melee test arena)
var god_mode := false
var force_input := false        # input test: treat input as live without a captured mouse
var player_class := "zealot"      # zealot, veteran, ogryn, psyker
var melee_only := true          # no guns: every gun pickup becomes a blade
var bot_count := 1               # teammates (when bots are enabled)
var bots_enabled := true       # teammates; turn off for solo testing (menu toggle or --no-bots)
var playing := false
var time := 0.0
var mouse_sensitivity := 0.0022
var fov := 85.0
var head_bob := 0.5            # 0 off, 0.5 low (default), 1 normal
var debug_overlay := false
var screenshots: Array = []     # [[seconds, path], ...] taken during --autotest


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	print("After Dark v%s" % VERSION)
	_setup_inputs()
	var args := OS.get_cmdline_user_args()
	autotest = "--autotest" in args
	for a in args:
		if a == "--sandbox":
			mode = "sandbox"
		if a == "--box-rigs":
			Infected.use_box_rigs = true
		if a == "--kaykit":
			SkinnedRig.style = "kaykit"
		if a.begins_with("--class="):
			player_class = a.substr(8)
		if a == "--no-bots":
			bots_enabled = false
		if a.begins_with("--seconds="):
			autotest_seconds = float(a.substr(10))
		if a.begins_with("--burst="):
			# --burst=start:count:interval:/dir  -> frame sequence for motion checks
			var bp := a.substr(8).split(":", false, 3)
			for i in int(bp[1]):
				screenshots.append([float(bp[0]) + i * float(bp[2]), "%s/burst_%02d.png" % [bp[3], i]])
		if a.begins_with("--shot="):
			# --shot=12.5:/abs/path.png
			var parts := a.substr(7).split(":", false, 1)
			screenshots.append([float(parts[0]), parts[1]])


func _process(delta: float) -> void:
	if playing and not get_tree().paused:
		time += delta


func _setup_inputs() -> void:
	var keys := {
		"move_forward": [KEY_W], "move_back": [KEY_S], "move_left": [KEY_A], "move_right": [KEY_D],
		"jump": [KEY_SPACE], "walk": [KEY_ALT], "sprint": [KEY_SHIFT], "crouch": [KEY_CTRL, KEY_C],
		"reload": [KEY_R], "use": [KEY_E], "flashlight": [KEY_F], "ping": [KEY_Z],
		"slot1": [KEY_1], "slot2": [KEY_2], "slot3": [KEY_3], "slot4": [KEY_4], "slot5": [KEY_5],
		"last_weapon": [KEY_Q], "sandbox_horde": [KEY_F5], "sandbox_special": [KEY_F6], "sandbox_god": [KEY_F7], "sandbox_tank": [KEY_F8], "sandbox_elite": [KEY_F9], "sandbox_weapon": [KEY_T], "special_key": [KEY_V], "help": [KEY_H], "scoreboard": [KEY_TAB], "pause": [KEY_ESCAPE], "ability": [KEY_G], "debug": [KEY_F3],
	}
	for action in keys:
		if not InputMap.has_action(action):
			InputMap.add_action(action)
		for k in keys[action]:
			var ev := InputEventKey.new()
			ev.physical_keycode = k
			InputMap.action_add_event(action, ev)
	var mouse := {
		"fire": MOUSE_BUTTON_LEFT, "shove": MOUSE_BUTTON_RIGHT, "special": MOUSE_BUTTON_MIDDLE,
		"next_weapon": MOUSE_BUTTON_WHEEL_DOWN, "prev_weapon": MOUSE_BUTTON_WHEEL_UP,
	}
	for action in mouse:
		if not InputMap.has_action(action):
			InputMap.add_action(action)
		var mb := InputEventMouseButton.new()
		mb.button_index = mouse[action]
		InputMap.action_add_event(action, mb)


# ---------------------------------------------------------------- difficulty

func common_hit_damage() -> float:
	return [1.0, 2.0, 5.0, 20.0][difficulty]

func special_damage_mult() -> float:
	return [0.6, 1.0, 1.5, 2.5][difficulty]

func ff_mult() -> float:
	return [0.0, 0.1, 0.3, 0.5][difficulty]

func tank_hp() -> float:
	return [3000.0, 4000.0, 8000.0, 8000.0][difficulty]

## Fewer survivors, smaller hordes (tuned for four with guns).
func team_scale() -> float:
	var n := (1 + bot_count) if bots_enabled else 1
	return 0.45 + 0.55 * clampf(n / 4.0, 0.0, 1.0)


func mob_size() -> int:
	return int(round([14, 22, 28, 32][difficulty] * team_scale()))

func max_specials() -> int:
	return maxi(1, int(round([2, 3, 4, 4][difficulty] * team_scale())))

func wanderer_cap() -> int:
	return int(round([20, 28, 34, 38][difficulty] * team_scale()))


# ---------------------------------------------------------------- queries

func alive_survivors() -> Array:
	return survivors.filter(func(s): return is_instance_valid(s) and not s.dead)

func standing_survivors() -> Array:
	return survivors.filter(func(s): return is_instance_valid(s) and not s.dead and not s.incapped and s.pinned_by == null)

func nearest_survivor(pos: Vector3, include_incapped := true) -> Node:
	var best = null
	var bd := INF
	for s in survivors:
		if not is_instance_valid(s) or s.dead:
			continue
		if not include_incapped and s.incapped:
			continue
		var d := pos.distance_squared_to(s.global_position)
		if d < bd:
			bd = d
			best = s
	return best

func specials_alive() -> Array:
	return infected.filter(func(z): return is_instance_valid(z) and z.is_special and not z.is_dead())

func commons_alive() -> int:
	var n := 0
	for z in infected:
		if is_instance_valid(z) and not z.is_special and not z.is_dead():
			n += 1
	return n


## Gunfire and explosions wake up idle infected nearby.
func make_noise(pos: Vector3, radius: float) -> void:
	var r2 := radius * radius
	for z in infected:
		if is_instance_valid(z) and not z.is_dead() and z.global_position.distance_squared_to(pos) < r2:
			z.hear_noise(pos)


## Survivors yell callouts; shown as subtitles.
func callout(who: Node, text: String) -> void:
	if hud and is_instance_valid(who):
		hud.add_callout(who.survivor_name, text, who.color)


func clear_world_lists() -> void:
	survivors.clear()
	infected.clear()
	usables.clear()
	hazards.clear()
	attractors.clear()
	player = null
	level = null
	director = null
