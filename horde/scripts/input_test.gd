extends Node
## --input-test : drives the real PlayerController through simulated input
## (Input.action_press/release with a captured mouse) and reports which
## melee states and actions were reached. Catches bugs on the human path
## that the autopilot never exercises.

var p: Survivor
var seen := {}
var log_lines: Array = []


func run() -> void:
	p = Game.player
	for c in p.get_children():
		if c is PlayerController:
			p.controller = c
	Input.mouse_mode = Input.MOUSE_MODE_CAPTURED
	Game.force_input = true
	Game.god_mode = true
	await _wait(0.5)
	# 1) melee: tap lights, hold a heavy, block, push, push-attack, dodge
	_slot(2)
	await _wait(0.6)
	for i in 3:
		await _tap("fire", 0.06, 0.45)
	await _hold("fire", 1.0)
	await _wait(0.8)
	Input.action_press("shove")
	await _wait(0.4)
	await _tap("fire", 0.06, 0.15)
	await _tap("fire", 0.06, 0.6)
	Input.action_release("shove")
	Input.action_press("move_left")
	await _tap("jump", 0.05, 0.4)
	Input.action_release("move_left")
	# 2) guns: switch, fire, reload, shove
	_slot(1)
	await _wait(0.6)
	for i in 5:
		await _tap("fire", 0.05, 0.12)
	await _tap("reload", 0.05, 2.5)
	await _tap("shove", 0.05, 0.8)
	# 3) items: medkit heal (hold), pills, throwable, ping, flashlight, use
	p.has_medkit = true
	p.health = 40.0
	_slot(4)
	await _wait(0.6)
	await _hold("fire", 5.4)
	p.has_pills = true
	_slot(5)
	await _wait(0.6)
	await _tap("fire", 0.05, 1.0)
	p.throwable = "pipe_bomb"
	_slot(3)
	await _wait(0.6)
	await _tap("fire", 0.05, 1.0)
	await _tap("ping", 0.05, 0.3)
	await _tap("flashlight", 0.05, 0.3)
	await _tap("use", 0.05, 0.3)
	p.ability_cd = 0.0
	await _tap("ability", 0.05, 0.3)
	if p.ability_cd > 0.0:
		seen["ability"] = true
	# 4) movement: sprint, slide out of the sprint, perfect dodge
	_slot(2)
	await _wait(0.4)
	# The sandbox horde can stun us or block the run-up: retry a few times.
	for attempt in 3:
		p.stun_t = 0.0
		p.yaw += PI * 0.5 * attempt
		Input.action_press("move_forward")
		Input.action_press("sprint")
		await _wait(0.8)
		Input.action_press("crouch")
		await _wait(0.4)
		Input.action_release("crouch")
		Input.action_release("sprint")
		Input.action_release("move_forward")
		await _wait(0.4)
		if seen.has("slid"):
			break
	p.dodges = 3
	p.dodge_cd = 0.0
	p.stun_t = 0.0
	p.riposte_t = 0.0
	Input.action_press("move_right")
	await _wait(0.1)
	await _tap("jump", 0.05, 0.0)
	await get_tree().physics_frame
	await get_tree().physics_frame
	if p.dodge_t > 0.0:
		p.take_damage(5.0, null, "claw")
	else:
		print("[input-test] dodge did not start (on floor %s)" % p.is_on_floor())
	await _wait(0.3)
	Input.action_release("move_right")
	if p.riposte_t > 0.0:
		seen["perfect_dodge"] = true
	# 4b) an attack winding up behind us shows a threat chevron
	var zb: Infected = Game.director.spawn_infected("common", p.global_position - p.flat_forward() * 1.5)
	await _wait(0.1)
	zb.target = p
	zb.attack_pending = 0.3
	await get_tree().process_frame
	await get_tree().process_frame
	if Game.hud.threat_ring.threats.size() > 0:
		seen["threat_warning"] = true
	zb.attack_pending = 0.0
	zb.queue_free()
	# 4c) T swaps the melee weapon in the sandbox (a real key event)
	var before_id: String = p.secondary["id"]
	var ev := InputEventKey.new()
	ev.physical_keycode = KEY_T
	ev.pressed = true
	Input.parse_input_event(ev)
	await get_tree().process_frame
	ev = ev.duplicate()
	ev.pressed = false
	Input.parse_input_event(ev)
	await _wait(0.2)
	if p.secondary["id"] != before_id:
		seen["swap_blade"] = true
	# 5) sabre parry: V just before a zombie's claw lands
	p.secondary = WeaponData.new_state("sabre")
	p.active_slot = Survivor.SLOT_SECONDARY
	p._refresh_held_model()
	await _wait(0.5)
	var z: Infected = Game.director.spawn_infected("common", p.global_position + p.flat_forward() * 1.3)
	await _wait(0.2)
	p.riposte_t = 0.0
	p.melee.stamina = 3.0
	await _tap("special_key", 0.05, 0.0)
	await get_tree().physics_frame
	var hp_before: float = p.health + p.toughness
	p.take_damage(10.0, z, "claw")
	if p.melee.state == "parry" and p.riposte_t > 0.0 and p.health + p.toughness >= hp_before:
		seen["parry"] = true
	await _wait(0.6)
	Input.action_press("move_forward")
	await _tap("jump", 0.05, 0.6)
	Input.action_press("crouch")
	await _wait(0.4)
	Input.action_release("crouch")
	Input.action_release("move_forward")
	_report()


func _process(_d: float) -> void:
	if p and is_instance_valid(p):
		seen["melee:" + p.melee.state] = true
		if p.action != "":
			seen["action:" + p.action] = true
		if p.dodge_t > 0.0:
			seen["dodged"] = true
		if p.reloading:
			seen["reloading"] = true
		if p.sprinting:
			seen["sprinted"] = true
		if p.slide_t > 0.0:
			seen["slid"] = true


func _slot(n: int) -> void:
	Input.action_press("slot%d" % n)
	await get_tree().process_frame
	await get_tree().physics_frame
	Input.action_release("slot%d" % n)


func _tap(action: String, hold: float, after: float) -> void:
	Input.action_press(action)
	await _wait(hold)
	Input.action_release(action)
	await _wait(after)


func _hold(action: String, t: float) -> void:
	Input.action_press(action)
	await _wait(t)
	Input.action_release(action)


func _wait(t: float) -> void:
	await get_tree().create_timer(t).timeout


func _report() -> void:
	var want := (["melee:windup", "melee:strike", "melee:follow", "melee:recover", "melee:charge", "melee:block",
		"melee:push", "dodged", "reloading", "action:heal_self", "action:pills", "ability", "sprinted", "slid", "perfect_dodge", "parry", "threat_warning", "swap_blade"])
	if Game.melee_only:
		want.erase("reloading")
	var missing := want.filter(func(w): return not seen.has(w))
	print("[input-test] reached: ", seen.keys())
	print("[input-test] missing: ", missing)
	print("[input-test] health %.0f toughness %.0f medkit %s pills %s throwable '%s'" % [p.health, p.toughness, p.has_medkit, p.has_pills, p.throwable])
	print("[input-test] RESULT ", "PASS" if missing.is_empty() else "FAIL")
	get_tree().quit(0 if missing.is_empty() else 1)
