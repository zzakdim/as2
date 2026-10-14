extends Node3D
## Game flow: title menu -> campaign of procedurally generated maps ->
## saferoom transitions -> finale. Also runs the headless soak test.

const SURVIVORS := [
	["Reyes", Color(0.85, 0.35, 0.25)],
	["Okafor", Color(0.3, 0.55, 0.9)],
	["Mags", Color(0.85, 0.75, 0.3)],
	["Dutch", Color(0.45, 0.8, 0.45)],
]

var world: Node3D
var carry: Array = []          # per-survivor state carried between maps
var carry_at_map_start: Array = []
var seed_base := 0
var autotest_t := 0.0
var _autotest_log_t := 0.0


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	Game.main = self
	Game.sfx = Sfx.new()
	add_child(Game.sfx)
	Game.hud = Hud.new()
	add_child(Game.hud)
	seed_base = randi()
	if Game.autotest:
		print("[autotest] starting, %.0fs" % Game.autotest_seconds)
		Engine.max_fps = 0
		start_campaign(Game.Diff.NORMAL)
	else:
		show_title()


func show_title() -> void:
	Game.playing = false
	_clear_world()
	var body := """A co-op horde shooter in the spirit of Left 4 Dead 2.
Fight from saferoom to saferoom with three AI teammates.

WASD move  ·  Mouse aim  ·  LMB fire  ·  RMB shove  ·  R reload  ·  E use / revive (hold)
1-5 weapons & items  ·  Q last weapon  ·  F flashlight  ·  Z ping  ·  G class ability  ·  Ctrl crouch
Tab stats  ·  F3 director overlay  ·  Esc pause

Medkit: select (4), hold LMB to heal yourself or RMB on a teammate.
Don't startle the Witch. Shove Boomers before you shoot them."""
	var buttons := []
	for d in 4:
		var diff: int = d
		buttons.append(["Play on %s" % Game.DIFF_NAMES[d], func():
			Game.mode = "campaign"
			start_campaign(diff)])
	buttons.append(["Melee Sandbox (greatsword, endless horde)", func():
		Game.mode = "sandbox"
		start_campaign(Game.Diff.NORMAL)])
	var style_name := "Placeholder boxes (fast)" if Infected.use_box_rigs else ("Realistic (Quaternius)" if SkinnedRig.style == "human" else "Stylized (KayKit)")
	buttons.append(["Characters: %s" % style_name, func():
		if Infected.use_box_rigs:
			Infected.use_box_rigs = false
			SkinnedRig.style = "human"
		elif SkinnedRig.style == "human":
			SkinnedRig.style = "kaykit"
		else:
			Infected.use_box_rigs = true
		show_title()])
	var cls: Array = Survivor.CLASSES[Game.player_class]
	buttons.append(["Class: %s (%s)" % [cls[0], cls[1]], func():
		var order := Survivor.CLASS_ORDER
		Game.player_class = order[(order.find(Game.player_class) + 1) % order.size()]
		show_title()])
	buttons.append(["Bot teammates: %s" % ("ON" if Game.bots_enabled else "OFF"), func():
		Game.bots_enabled = not Game.bots_enabled
		show_title()])
	buttons.append(["Quit", func(): get_tree().quit()])
	Game.hud.show_menu("AFTER DARK", body + "\n\nv" + Game.VERSION, buttons)


func start_campaign(diff: int) -> void:
	Game.difficulty = diff
	Game.map_index = 0
	carry.clear()
	load_map(0)


func load_map(idx: int) -> void:
	Game.hud.hide_menu()
	_clear_world()
	Game.hud.reset()
	Game.map_index = idx
	carry_at_map_start = carry.duplicate(true)
	world = Node3D.new()
	world.name = "World"
	world.process_mode = Node.PROCESS_MODE_PAUSABLE
	add_child(world)
	Game.world = world
	_build_environment()

	var fx := Effects.new()
	world.add_child(fx)
	Game.fx = fx

	var lvl := Level.new()
	world.add_child(lvl)
	Game.level = lvl
	var t0 := Time.get_ticks_msec()
	if Game.mode == "sandbox":
		lvl.generate_arena(seed_base)
	else:
		lvl.generate(seed_base + idx * 7919, idx)
	if Game.autotest:
		print("[autotest] map %d generated in %d ms (max_flow %d)" % [idx, Time.get_ticks_msec() - t0, lvl.max_flow])
	var weather: String = "clear" if Game.mode == "sandbox" else MAP_WEATHER[idx % MAP_WEATHER.size()]
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--weather="):
			weather = a.substr(10)
	if Game.mode == "sandbox" and world_env:
		# Arena: floodlit so the gore reads (the campaign keeps its night).
		world_env.ambient_light_energy = 0.9
		world_env.tonemap_exposure = 1.3
		var cc: Vector3 = lvl.spawn_points[0]
		for i in 4:
			var fl := SpotLight3D.new()
			var ang := TAU * (i + 0.5) / 4.0
			fl.position = cc + Vector3(cos(ang) * 11.0, 9.0, sin(ang) * 11.0)
			world.add_child(fl)
			fl.look_at(cc + Vector3(0, 0, 0), Vector3.UP)
			fl.spot_range = 30.0
			fl.spot_angle = 48.0
			fl.light_energy = 3.2
			fl.light_color = Color(1.0, 0.9, 0.78)
			fl.shadow_enabled = i % 2 == 0
	if weather == "rain":
		var w := Weather.new()
		world.add_child(w)
		w.setup(moon_light, world_env)

	for i in ((1 + Game.bot_count) if Game.bots_enabled else 1):
		var s := Survivor.new()
		var info: Array = SURVIVORS[i]
		s.setup(info[0], info[1], i != 0)
		# The player's class first; the bots take the others.
		var others := Survivor.CLASS_ORDER.filter(func(c): return c != Game.player_class)
		s.survivor_class = Game.player_class if i == 0 else others[(i - 1) % others.size()]
		s.position = lvl.spawn_points[i]
		s.yaw = PI   # face +Z, out of the saferoom
		world.add_child(s)
		if Game.mode == "sandbox":
			s.secondary = WeaponData.new_state("greatsword" if i == 0 else "fire_axe")
			s.primary = null if Game.melee_only else WeaponData.new_state("assault_rifle")
			s.active_slot = Survivor.SLOT_SECONDARY
			s.has_medkit = true
			s._refresh_held_model()
		elif i < carry.size():
			s.import_state(carry[i])
		elif idx == 0:
			s.primary = null
		if i == 0:
			var pc := PlayerController.new()
			pc.attach(s)
			if Game.autotest:
				BotBrain.new(s, true)  # autopilot drives; the camera still renders
			Game.player = s
		else:
			BotBrain.new(s)

	var dir := Director.new()
	world.add_child(dir)
	Game.director = dir
	Game.playing = true
	Game.time = 0.0
	Game.sfx.start_music()
	if Game.mode == "sandbox":
		Game.hud.map_label.text = "Melee Sandbox  ·  T swap blade  F5 horde  F6 special  F9 elites  F8 tank  F7 god mode (%s)" % ("on" if Game.god_mode else "off")
		Game.hud.big_message("Melee Sandbox", Color(0.9, 0.85, 0.75), 3.0)
		if not Game.autotest:
			Game.hud.toggle_help(1)
	else:
		Game.hud.map_label.text = "%s  ·  %s" % [Game.MAP_NAMES[idx], Game.DIFF_NAMES[Game.difficulty]]
		Game.hud.big_message(Game.MAP_NAMES[idx], Color(0.9, 0.85, 0.75), 4.0)
	if not Game.autotest:
		Input.mouse_mode = Input.MOUSE_MODE_CAPTURED
	get_tree().paused = false
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--melee-poses="):
			run_pose_sheet(a.substr(14))
		if a.begins_with("--lineup="):
			run_lineup(a.substr(9))
		if a.begins_with("--hit-test="):
			run_hit_test(a.substr(11))
		if a.begins_with("--cut-test="):
			run_cut_test(a.substr(11))
		if a.begins_with("--swing-test="):
			run_swing_test(a.substr(13))
		if a == "--mash-test":
			run_mash_test()
		if a.begins_with("--gun-sheet="):
			run_gun_sheet(a.substr(12))
		if a.begins_with("--kill-bot="):
			# --kill-bot=6 : a teammate dies after 6 s (rescue closet test)
			var delay := float(a.substr(11))
			get_tree().create_timer(delay).timeout.connect(func():
				for s in Game.survivors:
					if is_instance_valid(s) and s.is_bot and not s.dead:
						s.die()
						return)
		if a.begins_with("--spawn="):
			# --spawn=gunner,rager : spawn these 12 m ahead of the player, already hunting
			var k := 0
			for kind in a.substr(8).split(","):
				# "-common" spawns behind the player, close.
				var behind: bool = kind.begins_with("-")
				kind = kind.trim_prefix("-")
				var fw: Vector3 = Game.player.flat_forward()
				var at: Vector3 = Game.player.global_position + fw * (-2.5 if behind else 12.0) + fw.cross(Vector3.UP) * (k - 0.5) * 2.5 + Vector3(0, 0.1, 0)
				var z: Infected = Game.director.spawn_infected(kind, at)
				z.alert(Game.player)
				k += 1
		if a == "--input-test":
			var it = load("res://scripts/input_test.gd").new()
			add_child(it)
			it.run()


var world_env: Environment
var moon_light: DirectionalLight3D
const MAP_WEATHER := ["clear", "rain", "clear"]


func _build_environment() -> void:
	var env := Environment.new()
	env.background_mode = Environment.BG_COLOR
	env.background_color = Color(0.02, 0.025, 0.04)
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color(0.25, 0.3, 0.42)
	env.ambient_light_energy = 0.45
	env.tonemap_mode = Environment.TONE_MAPPER_ACES
	env.tonemap_exposure = 1.1
	env.fog_enabled = true
	env.fog_light_color = Color(0.08, 0.09, 0.12)
	env.fog_density = 0.035
	env.volumetric_fog_enabled = true
	env.volumetric_fog_density = 0.012
	env.volumetric_fog_albedo = Color(0.7, 0.75, 0.8)
	env.volumetric_fog_length = 48.0
	env.glow_enabled = true
	env.glow_intensity = 0.6
	env.glow_bloom = 0.05
	env.ssao_enabled = true
	env.ssao_radius = 1.2
	env.ssao_intensity = 1.5
	var we := WorldEnvironment.new()
	we.environment = env
	world_env = env
	world.add_child(we)
	var moon := DirectionalLight3D.new()
	moon.light_color = Color(0.55, 0.62, 0.85)
	moon.light_energy = 0.35
	moon.rotation = Vector3(deg_to_rad(-55), deg_to_rad(30), 0)
	moon.shadow_enabled = true
	moon.directional_shadow_max_distance = 60.0
	world.add_child(moon)
	moon_light = moon


func _clear_world() -> void:
	if world and is_instance_valid(world):
		world.queue_free()
		remove_child(world)
	world = null
	if Game.sfx:
		Game.sfx.stop_music()
	Game.clear_world_lists()
	Game.fx = null


# ================================================================== map end

func on_map_complete(final: bool) -> void:
	carry.clear()
	for s in _ordered_survivors():
		carry.append(s.export_state())
	var stats: String = Game.hud.stats_text()
	if Game.autotest:
		print("[autotest] map %d complete (final=%s) at t=%.1f\n%s" % [Game.map_index, final, Game.time, stats])
		if final or Game.map_index + 1 >= Game.MAPS:
			_autotest_finish(0)
		else:
			load_map.call_deferred(Game.map_index + 1)
		return
	Game.playing = false
	get_tree().paused = true
	if final:
		Game.hud.show_menu("RESCUED", "You made it out.\n\n" + stats, [
			["Play again", func(): start_campaign(Game.difficulty)],
			["Title screen", show_title],
		])
	else:
		Game.hud.show_menu("SAFEROOM", "%s complete.\n\n%s" % [Game.MAP_NAMES[Game.map_index], stats], [
			["Continue", func(): load_map(Game.map_index + 1)],
			["Title screen", show_title],
		])


func on_wipe() -> void:
	if Game.autotest:
		print("[autotest] team wiped on map %d at t=%.1f\n%s" % [Game.map_index, Game.time, Game.hud.stats_text()])
		carry = carry_at_map_start.duplicate(true)
		load_map.call_deferred(Game.map_index)
		return
	Game.playing = false
	get_tree().paused = true
	Game.hud.show_menu("YOU DIED", "The infected overran your team.\n\n" + Game.hud.stats_text(), [
		["Retry map", func():
			carry = carry_at_map_start.duplicate(true)
			load_map(Game.map_index)],
		["Title screen", show_title],
	])


func _ordered_survivors() -> Array:
	var out := []
	for info in SURVIVORS:
		for s in Game.survivors:
			if is_instance_valid(s) and s.survivor_name == info[0]:
				out.append(s)
	return out


# ================================================================== input / pause

func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("debug"):
		Game.debug_overlay = not Game.debug_overlay
	if Game.mode == "sandbox" and Game.playing and Game.director:
		if event.is_action_pressed("sandbox_horde"):
			Game.director.spawn_mob(20, "sandbox")
		if event.is_action_pressed("sandbox_special"):
			Game.director.sandbox_special()
		if event.is_action_pressed("sandbox_elite"):
			for i in 3:
				var c: Vector2i = Game.director.find_hidden_cell(0, Game.level.max_flow, 10.0)
				if c.x >= 0:
					var e: Infected = Game.director.spawn_infected(["shieldbearer", "rager", "gunner"][i % 3], Game.level.cell_center(c))
					e.alert(Game.player)
		if event.is_action_pressed("help"):
			Game.hud.toggle_help()
		if event.is_action_pressed("sandbox_weapon"):
			cycle_sandbox_melee()
		if event.is_action_pressed("sandbox_tank"):
			Game.director.spawn_tank_now()
		if event.is_action_pressed("sandbox_god"):
			Game.god_mode = not Game.god_mode
			Game.hud.big_message("God mode " + ("ON" if Game.god_mode else "OFF"), Color(1, 1, 0.6), 1.5)
	if event.is_action_pressed("pause") and Game.playing:
		if get_tree().paused:
			_resume()
		else:
			get_tree().paused = true
			Game.hud.show_menu("PAUSED", "", [
				["Resume", _resume],
				["Restart map", func():
					carry = carry_at_map_start.duplicate(true)
					load_map(Game.map_index)],
				["Mouse sensitivity +", func(): Game.mouse_sensitivity *= 1.2],
				["Mouse sensitivity -", func(): Game.mouse_sensitivity /= 1.2],
				["Field of view: %d  (+5)" % int(Game.fov), func():
					Game.fov = 70.0 if Game.fov >= 110.0 else Game.fov + 5.0
					Game.hud.big_message("FOV %d" % int(Game.fov), Color.WHITE, 1.0)],
				["Head bob: %s" % {0.0: "Off", 0.5: "Low", 1.0: "Normal"}.get(Game.head_bob, "Low"), func():
					Game.head_bob = {0.0: 0.5, 0.5: 1.0, 1.0: 0.0}.get(Game.head_bob, 0.5)
					Game.hud.big_message("Head bob: %s" % {0.0: "Off", 0.5: "Low", 1.0: "Normal"}[Game.head_bob], Color.WHITE, 1.0)],
				["Bot teammates: %s (restarts map)" % ("ON" if Game.bots_enabled else "OFF"), func():
					Game.bots_enabled = not Game.bots_enabled
					carry = carry_at_map_start.duplicate(true)
					load_map(Game.map_index)],
				["Title screen", show_title],
			])
	elif event is InputEventMouseButton and event.pressed and Game.playing and not get_tree().paused:
		Input.mouse_mode = Input.MOUSE_MODE_CAPTURED


func _resume() -> void:
	Game.hud.hide_menu()
	get_tree().paused = false
	Input.mouse_mode = Input.MOUSE_MODE_CAPTURED


func _notification(what: int) -> void:
	if what == NOTIFICATION_APPLICATION_FOCUS_OUT and Game.playing and not get_tree().paused and not Game.autotest:
		get_tree().paused = true
		Game.hud.show_menu("PAUSED", "", [["Resume", _resume], ["Title screen", show_title]])


# ================================================================== soak test

func _physics_process(delta: float) -> void:
	if not Game.autotest:
		return
	autotest_t += delta
	_autotest_log_t -= delta
	if _autotest_log_t <= 0.0 and Game.director:
		_autotest_log_t = 10.0
		var p = Game.player
		var prog: float = Game.level.progress_of(p.global_position) if p and is_instance_valid(p) else 0.0
		print("[autotest] t=%.0f map=%d progress=%.0f%% %s" % [autotest_t, Game.map_index, prog * 100.0, Game.director.debug_text().replace("\n", " | ")])
	for shot in Game.screenshots.duplicate():
		if autotest_t >= shot[0]:
			Game.screenshots.erase(shot)
			_save_screenshot(shot[1])
	if autotest_t >= Game.autotest_seconds:
		_autotest_finish(0)


const SANDBOX_MELEE := ["greatsword", "sabre", "executioner", "messer", "fire_axe", "sledgehammer", "machete"]

## Sandbox: T swaps the melee weapon in hand.
func cycle_sandbox_melee() -> void:
	var p: Survivor = Game.player
	if p == null or p.dead:
		return
	var cur: String = p.secondary["id"] if p.secondary else ""
	var nxt: String = SANDBOX_MELEE[(SANDBOX_MELEE.find(cur) + 1) % SANDBOX_MELEE.size()]
	p.secondary = WeaponData.new_state(nxt)
	p.active_slot = Survivor.SLOT_SECONDARY
	p._refresh_held_model()
	if p.controller and p.controller.has_method("on_weapon_changed"):
		p.controller.on_weapon_changed()
	Game.hud.big_message(WeaponData.get_def(nxt)["name"], Color(0.9, 0.85, 0.75), 1.2)


## --melee-poses=/dir : renders every greatsword attack at key frames
## (one PNG each) so swing arcs can be checked without playing.
func run_pose_sheet(dir: String) -> void:
	var p: Survivor = Game.player
	p.controller = p.get_node_or_null("PlayerController")
	for c in p.get_children():
		if c is PlayerController:
			p.controller = c
	p.melee_frozen = true
	var wid := "greatsword"
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--pose-weapon="):
			wid = a.substr(14)
	p.secondary = WeaponData.new_state(wid)
	p.active_slot = Survivor.SLOT_SECONDARY
	p._refresh_held_model()
	p.controller.on_weapon_changed()
	p.melee.set_weapon(wid)
	for z in Game.infected.duplicate():
		z.queue_free()
	Game.director.set_physics_process(false)
	await get_tree().create_timer(0.5).timeout
	var shots := [["idle", 0, "", 0.0], ["block", 0, "", 0.0], ["push", 0, "", 1.0]]
	for kind in ["light", "heavy"]:
		for i in p.melee.ms[kind].size():
			shots.append([kind, i, "windup", 1.0])
			if kind == "heavy":
				shots.append([kind, i, "charge", 1.0])
			for k in [0.25, 0.5, 0.75]:
				shots.append([kind, i, "strike", k])
			shots.append([kind, i, "follow", 1.0])
	for k in [0.0, 0.5, 1.0]:
		shots.append(["push_attack", 0, "strike", k])
	var n := 0
	if p.melee.ms.has("parry"):
		shots.insert(2, ["parry", 0, "", 0.0])
	for sh in shots:
		p.melee._swing_vis = {"strike": 1.0, "follow": 1.0, "windup": 0.6, "charge": 0.3}.get(sh[2], 0.0)
		p.melee.pose = p.melee.parry_pose() if sh[0] == "parry" else p.melee.pose_for(sh[0], sh[1], sh[2], sh[3])
		await get_tree().process_frame
		await get_tree().process_frame
		await RenderingServer.frame_post_draw
		var img := get_viewport().get_texture().get_image()
		var path := "%s/%02d_%s%d_%s_%.2f.png" % [dir, n, sh[0], sh[1], sh[2], sh[3]]
		img.save_png(path)
		n += 1
	print("[autotest] pose sheet: %d frames in %s" % [n, dir])
	get_tree().quit(0)


## --gun-sheet=/dir : first-person view of every gun (checks grips and scale).
func run_gun_sheet(dir: String) -> void:
	var p: Survivor = Game.player
	for c in p.get_children():
		if c is PlayerController:
			p.controller = c
	for z in Game.infected.duplicate():
		z.queue_free()
	Game.director.set_physics_process(false)
	Game.player.set_physics_process(false)
	await get_tree().create_timer(0.5).timeout
	var n := 0
	for id in ["pistol", "magnum", "smg", "pump_shotgun", "auto_shotgun", "assault_rifle", "hunting_rifle"]:
		var st := WeaponData.new_state(id)
		if WeaponData.get_def(id).get("slot", 1) == 0:
			p.primary = st
			p.active_slot = Survivor.SLOT_PRIMARY
		else:
			p.secondary = st
			p.active_slot = Survivor.SLOT_SECONDARY
		p._refresh_held_model()
		p.controller.on_weapon_changed()
		await get_tree().create_timer(1.2).timeout
		await RenderingServer.frame_post_draw
		get_viewport().get_texture().get_image().save_png("%s/%02d_%s.png" % [dir, n, id])
		n += 1
	print("[autotest] gun sheet: %d frames" % n)
	get_tree().quit(0)


## --hit-test=/dir : a zombie in front of the camera takes scripted hits;
## frames show the procedural hit reaction building and settling.
func run_hit_test(dir: String) -> void:
	var p: Survivor = Game.player
	for z in Game.infected.duplicate():
		z.queue_free()
	Game.director.set_physics_process(false)
	p.set_physics_process(false)
	for c in p.get_children():
		if c is PlayerController:
			c.set_process(false)
			c.set_physics_process(false)
			for v in c.camera.get_children():
				if v is Node3D and not v is Light3D:
					v.visible = false
	var targets := []
	for i in 3:
		var hk := "common"
		for arg in OS.get_cmdline_user_args():
			if arg.begins_with("--hit-kind="):
				hk = arg.substr(11)
		var z: Infected = Game.director.spawn_infected(hk, p.global_position + p.flat_forward() * 2.6 + p.flat_forward().cross(Vector3.UP) * (i - 1) * 1.1)
		targets.append(z)
	for z in targets:
		z.state = Infected.S.IDLE
		z.think_t = 999.0
	await get_tree().create_timer(0.6).timeout
	for z in targets:
		z.state = Infected.S.IDLE
		z.think_t = 999.0
		z.desired = Vector3.ZERO
		z.face_dir = -p.flat_forward()
	await get_tree().create_timer(0.4).timeout
	var right: Vector3 = p.flat_forward().cross(Vector3.UP)
	var center := Vector3.ZERO
	for z in targets:
		center += z.global_position / targets.size()
	var cam := get_viewport().get_camera_3d()
	var span: Vector3 = (targets[2].global_position - targets[0].global_position).normalized()
	var side := span.cross(Vector3.UP)
	cam.global_position = center + side * 3.6 + Vector3(0, 1.5, 0)
	cam.look_at(center + Vector3(0, 1.1, 0))
	for z in targets:
		z.face_dir = side
	var light := OmniLight3D.new()
	light.omni_range = 10.0
	light.light_energy = 3.0
	world.add_child(light)
	light.global_position = center + side * 2.5 + Vector3(0, 3, 0)
	var times := [0.0, 0.05, 0.1, 0.18, 0.3, 0.5, 0.9]
	var n := 0
	for hit in [["side", span, 6.0, "body"], ["thrust", -side, 6.0, "body"], ["head", -side, 3.0, "head"]]:
		for z in targets:
			z.rig.hit_react(hit[1], hit[2], hit[3])
		var t0 := 0.0
		for t in times:
			if t > t0:
				await get_tree().create_timer(t - t0).timeout
				t0 = t
			await RenderingServer.frame_post_draw
			get_viewport().get_texture().get_image().save_png("%s/%02d_%s_%.2f.png" % [dir, n, hit[0], t])
			n += 1
	# Knockdown: fall, lie, get up.
	for z in targets:
		z.knockdown(-side, 1.0)
	var t1 := 0.0
	for t in [0.15, 0.4, 0.8, 1.3, 2.0, 2.6, 3.2, 3.8]:
		await get_tree().create_timer(t - t1).timeout
		t1 = t
		await RenderingServer.frame_post_draw
		get_viewport().get_texture().get_image().save_png("%s/%02d_knockdown_%.2f.png" % [dir, n, t])
		n += 1
	# Kill: a heavy sideways sweep, then watch the ragdolls fall.
	await get_tree().create_timer(4.0).timeout
	var cuts := ["waist", "waist", "waist"]
	for i in targets.size():
		var z: Infected = targets[i]
		if not is_instance_valid(z) or z.is_dead():
			continue
		z.impact_dir = (span + Vector3(0, 0.25, 0)).normalized()
		z.impact_force = 7.0
		z.impact_point = z.global_position + Vector3(0, 1.2, 0)
		z.cut = cuts[i]
		z.take_damage(9999.0, Game.player, "body", "melee", z.impact_point)
	t1 = 0.0
	if OS.get_cmdline_user_args().has("--hit-top"):
		var z0: Node3D = targets[1]
		cam.global_position = z0.global_position + side * 2.4 + Vector3(0, 1.6, 0) - span * 1.2
		cam.look_at(z0.global_position + span * 0.8 + Vector3(0, 0.5, 0))
	for t in [0.05, 0.15, 0.3, 0.5, 0.8, 1.2, 1.8, 2.6]:
		await get_tree().create_timer(t - t1).timeout
		t1 = t
		await RenderingServer.frame_post_draw
		get_viewport().get_texture().get_image().save_png("%s/%02d_kill_%.2f.png" % [dir, n, t])
		n += 1
	print("[autotest] hit test: %d frames" % n)
	get_tree().quit(0)


## --cut-test=/dir:cut : one zombie, bright light, side camera; it takes a
## killing horizontal sweep with the given cut and frames are saved.
func run_cut_test(arg: String) -> void:
	var parts := arg.split(":")
	var dir := parts[0]
	var cut_kind := parts[1] if parts.size() > 1 else "waist"
	var p: Survivor = Game.player
	for z in Game.infected.duplicate():
		z.queue_free()
	Game.director.set_physics_process(false)
	p.set_physics_process(false)
	for c in p.get_children():
		if c is PlayerController:
			c.set_process(false)
			for v in c.camera.get_children():
				if v is Node3D and not v is Light3D:
					v.visible = false
	var fwd := p.flat_forward()
	var pos := p.global_position + fwd * 3.0
	var z: Infected = Game.director.spawn_infected("common", pos)
	z.state = Infected.S.IDLE
	z.think_t = 999.0
	z.face_dir = -fwd
	var side := fwd.cross(Vector3.UP)
	var light := OmniLight3D.new()
	light.omni_range = 9.0
	light.light_energy = 4.0
	world.add_child(light)
	light.global_position = pos + side * 2.0 + Vector3(0, 2.5, 0)
	var cam := Camera3D.new()
	world.add_child(cam)
	cam.current = true
	cam.global_position = pos + side * 2.3 + Vector3(0, 1.3, 0) - fwd * 0.5
	cam.look_at(pos + Vector3(0, 0.7, 0) - fwd * 0.5)
	Game.hud.root.visible = false
	await get_tree().create_timer(1.0).timeout
	z.desired = Vector3.ZERO
	z.velocity = Vector3.ZERO
	await get_tree().create_timer(0.3).timeout
	z.impact_dir = (-side + Vector3(0, 0.2, 0)).normalized()
	z.impact_force = 8.0
	z.impact_point = z.global_position + Vector3(0, 1.0, 0)
	z.cut = cut_kind
	z.take_damage(9999.0, p, "body", "melee", z.impact_point)
	var t1 := 0.0
	var n := 0
	for t in [0.03, 0.1, 0.2, 0.35, 0.55, 0.8, 1.2, 2.0]:
		await get_tree().create_timer(t - t1).timeout
		t1 = t
		Game.hud.root.visible = false
		await RenderingServer.frame_post_draw
		get_viewport().get_texture().get_image().save_png("%s/%02d_%s_%.2f.png" % [dir, n, cut_kind, t])
		n += 1
	print("[autotest] cut test: %d frames" % n)
	get_tree().quit(0)


## --swing-test=/dir:weapon:kind : a line of zombies in front of the player
## and a real (input-driven) heavy, then a light chain; frames every 50 ms.
func run_swing_test(arg: String) -> void:
	var a := arg.split(":")
	var dir := a[0]
	var wid := a[1] if a.size() > 1 else "greatsword"
	var mode := a[2] if a.size() > 2 else "heavy"
	var p: Survivor = Game.player
	for c in p.get_children():
		if c is PlayerController:
			p.controller = c
	for z in Game.infected.duplicate():
		z.queue_free()
	Game.director.set_physics_process(false)
	Game.force_input = true
	Game.god_mode = true
	p.secondary = WeaponData.new_state(wid)
	p.active_slot = Survivor.SLOT_SECONDARY
	p._refresh_held_model()
	p.controller.on_weapon_changed()
	var fwd := p.flat_forward()
	var side := fwd.cross(Vector3.UP)
	var light := OmniLight3D.new()
	light.omni_range = 10.0
	light.light_energy = 3.0
	world.add_child(light)
	light.global_position = p.global_position + fwd * 2.5 + Vector3(0, 2.8, 0)
	var zs := []
	for i in 5:
		var pos: Vector3 = p.global_position + fwd * (1.9 + 0.25 * absf(i - 2)) + side * (i - 2) * 0.75
		var z: Infected = Game.director.spawn_infected("common", pos)
		zs.append(z)
	await get_tree().create_timer(0.5).timeout
	for z in zs:
		z.state = Infected.S.IDLE
		z.think_t = 999.0
		z.desired = Vector3.ZERO
		z.face_dir = -fwd
	p.pitch = -0.05
	await get_tree().create_timer(0.4).timeout
	var n := [0]
	var shoot := func():
		await RenderingServer.frame_post_draw
		get_viewport().get_texture().get_image().save_png("%s/%03d.png" % [dir, n[0]])
		n[0] += 1
	if mode != "special":
		Input.action_press("fire")
	if mode == "heavy":
		# Hold to charge, release to swing.
		for i in 8:
			await get_tree().create_timer(0.07).timeout
		Input.action_release("fire")
		for i in 18:
			await get_tree().create_timer(0.05).timeout
			await shoot.call()
	elif mode == "special":
		p.melee.stamina = p.melee.ms["stamina"]
		Input.action_press("special_key")
		await get_tree().create_timer(0.05).timeout
		Input.action_release("special_key")
		for i in 18:
			await get_tree().create_timer(0.05).timeout
			await shoot.call()
	elif mode == "chop":
		# Kill the line with a heavy, then look down and hack at the bodies.
		for i in 8:
			await get_tree().create_timer(0.07).timeout
		Input.action_release("fire")
		await get_tree().create_timer(1.2).timeout
		p.pitch = -0.75
		for i in 30:
			await get_tree().create_timer(0.05).timeout
			if i % 7 == 1:
				Input.action_press("fire")
			if i % 7 == 2:
				Input.action_release("fire")
			await shoot.call()
	else:
		await get_tree().create_timer(0.05).timeout
		Input.action_release("fire")
		for i in 30:
			await get_tree().create_timer(0.05).timeout
			if i % 6 == 3:
				Input.action_press("fire")
			if i % 6 == 4:
				Input.action_release("fire")
			await shoot.call()
	print("[autotest] swing test: %d frames" % n[0])
	get_tree().quit(0)


## --mash-test : headless. Mashes the attack button with human-ish click
## timings on every melee weapon and counts swings that turned into heavies
## (should be none: spamming lights chains lights forever).
func run_mash_test() -> void:
	var p: Survivor = Game.player
	for c in p.get_children():
		if c is PlayerController:
			p.controller = c
	for z in Game.infected.duplicate():
		z.queue_free()
	Game.director.set_physics_process(false)
	Game.force_input = true
	Game.god_mode = true
	var bad := 0
	for wid in SANDBOX_MELEE:
		p.secondary = WeaponData.new_state(wid)
		p.active_slot = Survivor.SLOT_SECONDARY
		p._refresh_held_model()
		p.controller.on_weapon_changed()
		await get_tree().create_timer(0.3).timeout
		var lights := 0
		var heavies := 0
		var prev := ""
		var t := 0.0
		var rng := RandomNumberGenerator.new()
		rng.seed = 7
		while t < 10.0:
			Input.action_press("fire")
			var hold := rng.randf_range(0.05, 0.16)
			var gap := rng.randf_range(0.06, 0.2)
			var e := 0.0
			while e < hold + gap:
				if e >= hold:
					Input.action_release("fire")
				await get_tree().physics_frame
				var dt := get_physics_process_delta_time()
				e += dt
				var st: String = p.melee.state
				if st != prev:
					if st == "charge":
						heavies += 1
					elif st == "windup":
						lights += 1
					prev = st
			t += hold + gap
		Input.action_release("fire")
		await get_tree().create_timer(1.2).timeout
		# A real hold must still charge a heavy.
		Input.action_press("fire")
		var charged := false
		for i in 40:
			await get_tree().physics_frame
			charged = charged or p.melee.state == "charge"
		Input.action_release("fire")
		await get_tree().create_timer(1.2).timeout
		print("[mash] %-13s swings %3d  heavies %d  hold->heavy %s" % [wid, lights, heavies, charged])
		bad += heavies + (0 if charged else 1)
	print("[mash] %s" % ("PASS" if bad == 0 else "FAIL: %d accidental heavies" % bad))
	get_tree().quit(0 if bad == 0 else 1)


## --lineup=/dir : every character model in a row (with a light), then kills
## half of them with different cuts and screenshots the ragdolls.
func run_lineup(dir: String) -> void:
	var p: Survivor = Game.player
	for c in p.get_children():
		if c is PlayerController:
			p.controller = c
	Game.director.set_physics_process(false)
	for z in Game.infected.duplicate():
		z.queue_free()
	for s in Game.survivors:
		if s != p:
			s.set_physics_process(false)
			s.visible = false
	p.global_position = Game.level.cell_center(Game.level.start_door) + Vector3(0, 0.1, 4.5)
	p.yaw = 0.0
	p.pitch = -0.12
	var light := OmniLight3D.new()
	light.omni_range = 12.0
	light.light_energy = 2.5
	world.add_child(light)
	light.global_position = p.global_position + Vector3(0, 3, -2)
	var kinds := ["common", "shieldbearer", "rager", "gunner", "hunter", "smoker", "boomer", "charger", "spitter", "witch"]
	var actors := []
	for i in kinds.size():
		var pos: Vector3 = p.global_position + Vector3((i - 4.5) * 1.05, 0.0, -3.6)
		var z: Infected = Game.director.spawn_infected(kinds[i], pos)
		z.set_physics_process(false)
		actors.append(z)
	var surv_models := ["knight", "barbarian", "rogue_hooded", "adv_mage"]
	var surv_weapons := ["smg", "greatsword", "pump_shotgun", "fire_axe"]
	for i in 4:
		var hairs := [["Hair_SimpleParted", "Hair_Beard"], ["Hair_Buzzed"], ["Hair_Buns"], ["Hair_Long", "Hair_Beard"]]
		var cols := [Color(0.85, 0.35, 0.25), Color(0.3, 0.55, 0.9), Color(0.85, 0.75, 0.3), Color(0.45, 0.8, 0.45)]
		var r: Rig = SkinnedRig.create(surv_models[i], {"role": "survivor", "hair": hairs[i], "top": cols[i].darkened(0.35), "bottom": Color(0.17, 0.18, 0.2)})
		if r is SkinnedRig:
			r.melee_held = WeaponData.get_def(surv_weapons[i]).get("melee", false)
		r.held.add_child(WeaponData.build_model(surv_weapons[i]))
		world.add_child(r)
		r.global_position = p.global_position + Vector3((i - 1.5) * 1.1, 0.0, -7.0)
		r.set_pose("aim")
		actors.append(r)
	await get_tree().create_timer(0.3).timeout
	for i in 20:
		for a in actors:
			if is_instance_valid(a):
				var rg = a.rig if a is Infected else a
				rg.rotation.y = PI
				rg.animate(0.016, 0.0)
		await get_tree().process_frame
	await RenderingServer.frame_post_draw
	get_viewport().get_texture().get_image().save_png(dir + "/lineup_a.png")
	var cuts := ["decap", "bisect", "arm", "", "split"]
	for i in 5:
		var z: Infected = actors[i]
		z.set_physics_process(true)
		z.impact_dir = Vector3(randf_range(-0.5, 0.5), 0.3, -1).normalized()
		z.rig.rotation.y = PI
		z.impact_force = 9.0
		z.cut = cuts[i]
		z.take_damage(9999.0, p, "body", "melee", z.global_position + Vector3(0, 1.1, 0))
	await get_tree().create_timer(1.2).timeout
	await RenderingServer.frame_post_draw
	get_viewport().get_texture().get_image().save_png(dir + "/lineup_b.png")
	print("[autotest] lineup saved to ", dir)
	get_tree().quit(0)


func _save_screenshot(path: String) -> void:
	await RenderingServer.frame_post_draw
	var img := get_viewport().get_texture().get_image()
	if img:
		img.save_png(path)
		print("[autotest] screenshot saved: ", path)


func _autotest_finish(code: int) -> void:
	print("[autotest] done after %.1fs of game time\n%s" % [autotest_t, Game.hud.stats_text()])
	get_tree().quit(code)
