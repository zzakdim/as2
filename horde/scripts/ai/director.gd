class_name Director
extends Node
## The AI Director: paces the run by tracking how stressed each survivor is.
##
## Build-up -> Peak -> Relax. While building up it populates wandering
## infected ahead of the team, sends mobs on a timer and spawns specials, always
## out of sight. Once anyone's intensity peaks it holds off for a breather.
## It also runs the scripted beats: the Tank, Witches, the crescendo gate,
## car alarms, bile and the finale.

enum Phase { BUILD_UP, PEAK, RELAX }
const PHASE_NAMES := ["BUILD UP", "PEAK", "RELAX"]

var phase: int = Phase.BUILD_UP
var phase_t := 0.0
var intensity := {}
var mob_timer := 60.0
var special_timer := 20.0
var wander_t := 0.0
var tank_at := -1.0
var tank_spawned := false
var tank_alive := false
var bile_mob_cd := 0.0
var crescendo_active := false
var crescendo_t := 0.0
var crescendo_wave_t := 0.0
var gate_opened := false
var finale_stage := -1
var finale_t := 0.0
var rescue_arrived := false
var finished := false
var wiped := false
var started := false
var leave_t := 0.0
var special_classes := ["hunter", "smoker", "boomer", "charger", "spitter", "jockey"]
var _rng := RandomNumberGenerator.new()


func _ready() -> void:
	_rng.randomize()
	mob_timer = _rng.randf_range(70.0, 110.0)
	special_timer = _rng.randf_range(25.0, 40.0)
	var lvl = Game.level
	if Game.mode == "sandbox":
		started = true
		return
	if lvl.map_index > 0 or _rng.randf() < 0.6:
		tank_at = _rng.randf_range(0.35, 0.75)
	if lvl.is_finale:
		tank_at = -1.0
	_populate_initial()
	for p in lvl.witch_spots:
		spawn_infected("witch", p)


# ================================================================== loop

func _physics_process(delta: float) -> void:
	if finished or wiped:
		return
	if Game.mode == "sandbox":
		_sandbox(delta)
		return
	var lvl = Game.level
	_update_intensity(delta)
	var max_int := 0.0
	for s in intensity:
		max_int = max(max_int, intensity[s])
	var lead := _lead_flow()
	if not started:
		# Nothing happens until someone leaves the saferoom.
		for s in Game.alive_survivors():
			if not lvl.start_room.has_point(lvl.cell_of(s.global_position)):
				started = true
		if not started:
			return

	match phase:
		Phase.BUILD_UP:
			if max_int >= 0.95:
				phase = Phase.PEAK
				phase_t = _rng.randf_range(3.0, 5.0)
		Phase.PEAK:
			phase_t -= delta
			if phase_t <= 0.0:
				phase = Phase.RELAX
				phase_t = _rng.randf_range(30.0, 45.0)
		Phase.RELAX:
			phase_t -= delta
			if phase_t <= 0.0 and max_int < 0.4 and _threats_near() < 4:
				phase = Phase.BUILD_UP

	# Wanderers ahead of the team
	wander_t -= delta
	if wander_t <= 0.0:
		wander_t = 1.0
		_maintain_wanderers(lead)
		_cull_far(lead)

	# Mobs
	if phase == Phase.BUILD_UP and not tank_alive and not crescendo_active and finale_stage < 0:
		mob_timer -= delta
		if mob_timer <= 0.0:
			mob_timer = _rng.randf_range(90.0, 180.0) * (1.0 - Game.difficulty * 0.12)
			spawn_mob(Game.mob_size(), "timer")

	# Specials
	if phase != Phase.RELAX or crescendo_active or finale_stage >= 0:
		special_timer -= delta
		if special_timer <= 0.0:
			special_timer = _rng.randf_range(18.0, 32.0) * (1.0 - Game.difficulty * 0.1)
			if Game.specials_alive().filter(func(z): return z.kind != "witch" and z.kind != "tank").size() < Game.max_specials():
				_spawn_special()

	# Tank
	if tank_at > 0.0 and not tank_spawned and float(lead) / lvl.max_flow >= tank_at:
		tank_spawned = true
		_spawn_tank()

	bile_mob_cd = max(0.0, bile_mob_cd - delta)
	if crescendo_active:
		_update_crescendo(delta)
	if finale_stage >= 0:
		_update_finale(delta)
	_music()


# ================================================================== sandbox

var _sandbox_t := 3.0
var _sandbox_special_t := 25.0
var _sandbox_kinds_i := 0

## Melee test arena: keep a steady stream of commons coming, specials now and then.
func _sandbox(delta: float) -> void:
	_sandbox_t -= delta
	if _sandbox_t <= 0.0:
		_sandbox_t = 4.0
		if Game.commons_alive() < 30:
			spawn_mob(12, "sandbox")
	_sandbox_special_t -= delta
	if _sandbox_special_t <= 0.0:
		_sandbox_special_t = 30.0
		sandbox_special()
	_music()


func sandbox_special() -> void:
	var kinds := ["shieldbearer", "hunter", "rager", "boomer", "charger", "jockey", "gunner", "smoker", "rager", "spitter"]
	var kind: String = kinds[_sandbox_kinds_i % kinds.size()]
	_sandbox_kinds_i += 1
	var c := find_hidden_cell(0, Game.level.max_flow, 14.0)
	if c.x >= 0:
		spawn_infected(kind, Game.level.cell_center(c))
		Game.hud.add_callout("", "Spawned a %s" % kind.capitalize(), Color(1, 0.8, 0.5))


func _lead_flow() -> int:
	var lead := 0
	for s in Game.alive_survivors():
		lead = max(lead, Game.level.flow_at(s.global_position))
	return lead


func _update_intensity(delta: float) -> void:
	for s in Game.survivors:
		if not is_instance_valid(s) or s.dead:
			intensity.erase(s)
			continue
		var v: float = intensity.get(s, 0.0)
		# Only decay when nothing is actively on them.
		if _threats_near_pos(s.global_position, 8.0) == 0 and s.pinned_by == null and not s.incapped:
			v = max(0.0, v - delta * 0.04)
		intensity[s] = v


func add_intensity(s, amount: float) -> void:
	intensity[s] = clamp(intensity.get(s, 0.0) + amount, 0.0, 1.0)


func on_infected_killed(z, killer) -> void:
	if killer and is_instance_valid(killer) and killer is Survivor and z.global_position.distance_to(killer.global_position) < 5.0:
		add_intensity(killer, 0.025)


func _threats_near() -> int:
	var n := 0
	for z in Game.infected:
		if is_instance_valid(z) and not z.is_dead() and (z.state == Infected.S.CHASE or z.state == Infected.S.ATTACK or z.is_special):
			n += 1
	return n


func _threats_near_pos(p: Vector3, r: float) -> int:
	var n := 0
	var r2 := r * r
	for z in Game.infected:
		if is_instance_valid(z) and not z.is_dead() and z.state != Infected.S.IDLE and z.state != Infected.S.WANDER:
			if z.global_position.distance_squared_to(p) < r2:
				n += 1
	return n


# ================================================================== spawning

func spawn_infected(kind: String, pos: Vector3) -> Infected:
	var z: Infected
	match kind:
		"shieldbearer", "rager", "gunner": z = Elite.make(kind)
		"hunter": z = Hunter.new()
		"jockey": z = Jockey.new()
		"smoker": z = Smoker.new()
		"boomer": z = Boomer.new()
		"charger": z = Charger.new()
		"spitter": z = Spitter.new()
		"tank": z = Tank.new()
		"witch": z = Witch.new()
		_: z = Infected.new()
	z.position = pos + Vector3(0, 0.05, 0)
	z.rotation.y = 0.0
	Game.world.add_child(z)
	return z


## A cell that no survivor can currently see, roughly `ahead` cells in front
## of (positive) or behind (negative) the lead survivor.
func find_hidden_cell(flow_min: int, flow_max: int, min_dist: float) -> Vector2i:
	var lvl = Game.level
	var alive := Game.alive_survivors()
	var fallback := Vector2i(-1, -1)
	for attempt in 40:
		var c: Vector2i = lvl.random_cell_in_flow(flow_min, flow_max)
		if c.x < 0:
			continue
		var p: Vector3 = lvl.cell_center(c)
		# Must be able to reach the survivors (not behind a locked gate or door).
		if lvl.field_survivors.dist[lvl.idx(c)] >= FlowField.UNREACHED:
			continue
		var ok := true
		for s in alive:
			var d: float = s.global_position.distance_to(p)
			if d < min_dist:
				ok = false
				break
			if d < 45.0 and lvl.los(s.eye_pos(), p + Vector3(0, 1.0, 0)):
				ok = false
				break
		if lvl.start_room.has_point(c) or (not lvl.is_finale and lvl.end_room.has_point(c)):
			ok = false
		if ok:
			return c
		if fallback.x < 0:
			var far := true
			for s in alive:
				if s.global_position.distance_to(p) < min_dist:
					far = false
			if far:
				fallback = c
	return fallback


var populated_upto := 0

## Wanderers are placed once per area as the team approaches it (like L4D's
## director populating nav areas when they come into the "active set"),
## so fighting in one spot doesn't produce an endless trickle.
func _populate_initial() -> void:
	populated_upto = 12
	_populate_until(int(Game.level.max_flow * 0.3), false)


func _populate_until(flow_to: int, hidden_only: bool) -> void:
	var lvl = Game.level
	flow_to = min(flow_to, lvl.max_flow - 4)
	if flow_to <= populated_upto:
		return
	var span := flow_to - populated_upto
	var density: float = [0.6, 0.8, 1.0, 1.1][Game.difficulty]
	var n := int(span * density)
	for i in n:
		if Game.commons_alive() > 110:
			break
		var c: Vector2i
		if hidden_only:
			c = find_hidden_cell(populated_upto, flow_to, 20.0)
		else:
			c = lvl.random_cell_in_flow(populated_upto, flow_to)
		if c.x >= 0:
			_spawn_wanderer(lvl.cell_center(c))
	populated_upto = flow_to


func _spawn_wanderer(p: Vector3) -> void:
	var z := Infected.new()
	z.position = p + Vector3(randf_range(-0.7, 0.7), 0.05, randf_range(-0.7, 0.7))
	if randf() < 0.25:
		z.sitting = true
	z.state = Infected.S.IDLE if randf() < 0.7 else Infected.S.WANDER
	Game.world.add_child(z)
	z.rig.rotation.y = randf() * TAU


func _maintain_wanderers(lead: int) -> void:
	_populate_until(lead + 32, true)


func _cull_far(lead: int) -> void:
	var lvl = Game.level
	for z in Game.infected.duplicate():
		if not is_instance_valid(z) or z.is_dead() or z.kind == "tank" or z.kind == "witch":
			continue
		if z.get("victim") != null:
			continue
		var f: int = lvl.flow_at(z.global_position)
		var near = Game.nearest_survivor(z.global_position)
		if near == null:
			return
		var d: float = near.global_position.distance_to(z.global_position)
		if f < lead - 30 and d > 50.0 and not lvl.los(near.eye_pos(), z.global_position):
			z.queue_free()
			Game.infected.erase(z)


func spawn_mob(size: int, reason: String) -> void:
	var lvl = Game.level
	var lead := _lead_flow()
	if Game.commons_alive() > 120:
		return
	var c: Vector2i
	if Game.mode == "sandbox":
		c = find_hidden_cell(0, lvl.max_flow, 16.0)
	else:
		if _rng.randf() < 0.4:
			c = find_hidden_cell(lead - 30, lead - 12, 18.0)   # behind
		else:
			c = find_hidden_cell(lead + 12, lead + 30, 18.0)   # ahead
		if c.x < 0:
			c = find_hidden_cell(max(0, lead - 40), lead + 40, 14.0)
	if c.x < 0:
		return
	var base: Vector3 = lvl.cell_center(c)
	var elites: int = [0, 1, 2, 3][Game.difficulty] if size >= 10 else 0
	for i in elites:
		var e := Elite.make((["shieldbearer", "rager"] if Game.melee_only else ["shieldbearer", "rager", "rager", "shieldbearer", "gunner"]).pick_random())
		e.position = base + Vector3(randf_range(-1.5, 1.5), 0.05, randf_range(-1.5, 1.5))
		e.state = Infected.S.CHASE
		Game.world.add_child(e)
	for i in size - elites:
		var z := Infected.new()
		var off := Vector3(randf_range(-2.5, 2.5), 0.05, randf_range(-2.5, 2.5))
		var p := base + off
		if not lvl.is_walkable_cell(lvl.cell_of(p)):
			p = base + Vector3(randf_range(-0.6, 0.6), 0.05, randf_range(-0.6, 0.6))
		z.position = p
		z.state = Infected.S.CHASE
		z.mob = true
		Game.world.add_child(z)
	Game.sfx.play3d("horde", base + Vector3(0, 2, 0), 10.0, 0.0)
	Game.sfx.play2d("horde_sting", -6.0)
	if reason != "crescendo" and reason != "finale":
		var s = Game.alive_survivors().pick_random() if not Game.alive_survivors().is_empty() else null
		if s:
			Game.callout(s, ["Here they come!", "Horde!", "Oh no, here they come!", "Get ready!"].pick_random())


func _spawn_special() -> void:
	var alive_kinds := {}
	for z in Game.specials_alive():
		alive_kinds[z.kind] = alive_kinds.get(z.kind, 0) + 1
	var options := special_classes.filter(func(k): return alive_kinds.get(k, 0) == 0)
	if options.is_empty():
		return
	var kind: String = options[_rng.randi() % options.size()]
	var lead := _lead_flow()
	var c := find_hidden_cell(lead - 10, lead + 25, 16.0)
	if c.x < 0:
		return
	spawn_infected(kind, Game.level.cell_center(c))


func _spawn_tank() -> void:
	var lead := _lead_flow()
	var c := find_hidden_cell(lead + 10, lead + 25, 20.0)
	if c.x < 0:
		c = find_hidden_cell(lead - 25, lead - 10, 20.0)
	if c.x < 0:
		return
	tank_alive = true
	spawn_infected("tank", Game.level.cell_center(c))
	Game.hud.big_message("TANK!", Color(1, 0.3, 0.2), 3.0)
	var s = Game.alive_survivors().pick_random() if not Game.alive_survivors().is_empty() else null
	if s:
		Game.callout(s, "TANK! Everyone get together!")


func spawn_tank_now() -> void:
	tank_spawned = true
	_spawn_tank()


func on_tank_dead() -> void:
	tank_alive = false
	for z in Game.infected:
		if is_instance_valid(z) and z.kind == "tank" and not z.is_dead():
			tank_alive = true
	if not tank_alive:
		Game.hud.big_message("Tank down", Color(0.8, 0.9, 1.0), 2.0)
		if finale_stage >= 0 and finale_t > 100.0:
			finale_t = 6.0


func on_biled(_s) -> void:
	if bile_mob_cd > 0.0:
		return
	bile_mob_cd = 12.0
	spawn_mob(Game.mob_size(), "bile")


# ================================================================== crescendo

func start_crescendo() -> void:
	if crescendo_active or gate_opened:
		return
	crescendo_active = true
	crescendo_t = 50.0
	crescendo_wave_t = 2.0
	Game.hud.big_message("The gate is opening... hold out!", Color(1, 0.8, 0.3), 3.5)
	Game.sfx.play2d("horde_sting", 0.0)


func _update_crescendo(delta: float) -> void:
	crescendo_t -= delta
	crescendo_wave_t -= delta
	if crescendo_wave_t <= 0.0:
		crescendo_wave_t = _rng.randf_range(9.0, 13.0)
		spawn_mob(int(Game.mob_size() * 0.6), "crescendo")
	if crescendo_t <= 0.0:
		crescendo_active = false
		gate_opened = true
		Game.level.open_gate()
		Game.hud.big_message("The gate is open! Go go go!", Color(0.6, 1.0, 0.6), 3.0)
		phase = Phase.RELAX
		phase_t = 20.0


# ================================================================== finale

const FINALE_SCRIPT := [
	["mob", 8.0], ["mob", 12.0], ["special", 4.0], ["mob", 12.0], ["tank", 30.0],
	["mob", 10.0], ["mob", 10.0], ["special", 4.0], ["mob", 12.0], ["tank", 30.0],
	["rescue", 0.0],
]

func start_finale() -> void:
	if finale_stage >= 0:
		return
	finale_stage = 0
	finale_t = 15.0
	Game.hud.big_message("Rescue is on the way. Survive!", Color(1, 0.8, 0.3), 4.0)
	Game.sfx.play3d("radio", Game.level.cell_center(Game.level.radio_cell) + Vector3(0, 1, 0), 4.0)


func _update_finale(delta: float) -> void:
	if rescue_arrived:
		_check_rescue(delta)
		return
	finale_t -= delta
	if finale_t > 0.0:
		return
	if finale_stage >= FINALE_SCRIPT.size():
		return
	var step: Array = FINALE_SCRIPT[finale_stage]
	finale_stage += 1
	finale_t = step[1]
	match step[0]:
		"mob":
			spawn_mob(Game.mob_size(), "finale")
		"special":
			_spawn_special()
			_spawn_special()
		"tank":
			spawn_tank_now()
		"rescue":
			rescue_arrived = true
			Game.hud.big_message("The rescue chopper is here! Get to the landing zone!", Color(0.5, 1, 0.5), 5.0)
			var zone = Game.level.get_node_or_null("RescueZone")
			if zone:
				zone.material_override = Mats.unshaded(Color(0.2, 1.0, 0.3, 0.35), true)
			Game.sfx.start_loop("helicopter", zone if zone else Game.level, 6.0)
	# During the tank stages, wait for the tank to die before continuing.
	if step[0] == "tank":
		finale_t = 9999.0


func _check_rescue(delta: float) -> void:
	var lvl = Game.level
	var alive := Game.alive_survivors()
	var all_in := true
	var any_in := false
	for s in alive:
		if s.incapped:
			continue
		if lvl.in_rescue_zone(s.global_position):
			any_in = true
		else:
			all_in = false
	if Game.player and is_instance_valid(Game.player) and not Game.player.dead and lvl.in_rescue_zone(Game.player.global_position) and any_in:
		leave_t += delta
		if all_in or leave_t > 8.0:
			_win(true)
	else:
		leave_t = 0.0


# ================================================================== end conditions

func check_end_saferoom() -> void:
	var lvl = Game.level
	var alive := Game.alive_survivors()
	if alive.is_empty():
		return
	for s in alive:
		if not lvl.in_end_room(s.global_position):
			Game.hud.add_callout("", "Everyone needs to be inside the saferoom.", Color(1, 0.8, 0.4))
			return
	_win(false)


func _win(final: bool) -> void:
	if finished:
		return
	finished = true
	Game.main.on_map_complete(final)


## A bot died: in a while, lock them in a rescue closet ahead of the team.
func on_survivor_died(s) -> void:
	if not s.is_bot or Game.mode == "sandbox" or Game.level == null or Game.level.is_finale:
		return
	await get_tree().create_timer(15.0 if not Game.autotest else 4.0).timeout
	if not is_instance_valid(s) or not s.dead or Game.level == null or not is_instance_valid(Game.level):
		return
	var lvl = Game.level
	var lead := _lead_flow()
	var dirs := [Vector2i(1, 0), Vector2i(-1, 0), Vector2i(0, 1), Vector2i(0, -1)]
	for attempt in 60:
		var c: Vector2i = lvl.random_cell_in_flow(lead + 6, lead + 30)
		if c.x < 0:
			continue
		for d in dirs:
			var w: Vector2i = c + d
			if lvl.in_bounds(w) and lvl.get_t(w.x, w.y) == lvl.T_WALL and not lvl.indoor_rect.has_point(w):
				var closet := Props.RescueCloset.new()
				closet.who = s
				closet.outward = Vector3(-d.x, 0, -d.y)
				lvl.add_child(closet)
				# On the building face, looking out into the street.
				closet.global_position = lvl.cell_center(c) + Vector3(d.x, 0, d.y) * (lvl.CELL * 0.5 - 0.12)
				closet.rotation.y = atan2(closet.outward.x, closet.outward.z)
				if Game.autotest:
					print("[autotest] rescue closet for %s at %s" % [s.survivor_name, closet.global_position])
				Game.callout(Game.alive_survivors().pick_random() if not Game.alive_survivors().is_empty() else s, "I hear %s! Up ahead!" % s.survivor_name)
				return


func check_wipe() -> void:
	if wiped or finished:
		return
	# The run ends when nobody is left standing (or the player is dead).
	var standing := 0
	for s in Game.survivors:
		if is_instance_valid(s) and not s.dead and not s.incapped and s.pinned_by == null:
			standing += 1
	var player_dead: bool = Game.player != null and is_instance_valid(Game.player) and Game.player.dead
	if not Game.bots_enabled:
		standing = 1  # solo: only death ends the run (you can self-revive)
	if standing == 0 or player_dead:
		await get_tree().create_timer(2.5).timeout
		# Re-check: someone may have been freed in the meantime.
		standing = 0
		for s in Game.survivors:
			if is_instance_valid(s) and not s.dead and not s.incapped and s.pinned_by == null:
				standing += 1
		player_dead = Game.player != null and is_instance_valid(Game.player) and Game.player.dead
		if not Game.bots_enabled:
			standing = 1
		if (standing == 0 or player_dead) and not wiped and not finished:
			wiped = true
			Game.main.on_wipe()


func _process(_delta: float) -> void:
	# Periodic wipe check catches cases like a lone survivor getting pinned.
	if Engine.get_process_frames() % 30 == 0:
		check_wipe()


func _music() -> void:
	if tank_alive:
		Game.sfx.set_music("tank")
	elif crescendo_active:
		Game.sfx.set_music("crescendo")
	elif phase == Phase.RELAX:
		Game.sfx.set_music("quiet")
	else:
		Game.sfx.set_music("ambient")


func debug_text() -> String:
	var lines := []
	lines.append("Director: %s  (%.0fs)" % [PHASE_NAMES[phase], max(phase_t, 0.0)])
	for s in intensity:
		if is_instance_valid(s):
			lines.append("  %s intensity %.2f" % [s.survivor_name, intensity[s]])
	lines.append("Mob in %.0fs   Special in %.0fs" % [mob_timer, special_timer])
	lines.append("Commons %d   Specials %d" % [Game.commons_alive(), Game.specials_alive().size()])
	var lvl = Game.level
	lines.append("Progress %.0f%%   Tank at %s" % [100.0 * _lead_flow() / lvl.max_flow, "%.0f%%" % (tank_at * 100) if tank_at > 0 else "none"])
	lines.append("FPS %d" % Engine.get_frames_per_second())
	return "\n".join(lines)
