class_name BotBrain
extends RefCounted
## Survivor bot AI: follow the leader, shoot what's dangerous, save pinned
## teammates, revive the downed, heal when hurt, grab better guns.
## With `autopilot` it plays the map on its own (used by the soak test).

var s: Survivor
var autopilot := false
var target = null
var forced_target = null
var scan_t := 0.0
var react_t := 0.0
var aim_err := Vector3.ZERO
var stuck_t := 0.0
var last_pos := Vector3.ZERO
var jitter_t := 0.0
var jitter_dir := Vector3.ZERO
var callout_cd := 0.0
var follow_offset := Vector3.ZERO
var item_t := 0.0
var tap := false
var spotted := {}
var dim := false          # the not-so-bright teammate
var daze_t := 0.0         # staring at nothing
var daze_cd := 20.0
var air_swing_t := 0.0

const DIM_LINES := ["Is that one dead?", "Which way are we going?", "I'm helping!", "Got it! ...I think.",
	"Did you hear that? No? Okay.", "My sword's sharp. Probably.", "Wait for me!", "Was that me?", "I love this job."]


func _init(surv: Survivor, auto := false) -> void:
	s = surv
	autopilot = auto
	s.controller = self
	dim = not auto and Game.melee_only
	follow_offset = Vector3(randf_range(-2.5, 2.5), 0, randf_range(-2.5, 2.5))


func update(delta: float) -> void:
	s.fire_held = false
	s.block_held = false
	if s.dead:
		return
	callout_cd = max(0.0, callout_cd - delta)
	for u in Game.usables:
		if u is Props.RescueCloset and is_instance_valid(u) and u.can_use(s) and u.global_position.distance_to(s.global_position) < 2.2:
			u.on_use(s)
	if s.ability_cd <= 0.0 and not s.incapped:
		# Shout when swarmed or about to lose toughness in a crowd.
		var close := 0
		for z in Game.infected:
			if is_instance_valid(z) and not z.is_dead() and z.global_position.distance_squared_to(s.global_position) < 12.0:
				close += 1
		match s.survivor_class:
			"veteran", "psyker":
				# Spend it on a special or elite they're fighting.
				if target and is_instance_valid(target) and (target.is_special or target is Elite):
					s.want_ability = true
			_:
				if close >= 6 or (close >= 3 and s.toughness < 25.0):
					s.want_ability = true
	react_t = max(0.0, react_t - delta)
	scan_t -= delta
	if scan_t <= 0.0:
		scan_t = randf_range(0.12, 0.22)
		_scan()
	if dim and _dim_update(delta):
		return
	_aim(delta)
	_combat()
	if s.incapped or s.pinned_by != null:
		s.move_dir = Vector3.ZERO
		return
	_move(delta)


## The dim teammate: every so often stops to stare at something, swings at
## thin air, and says things. Returns true while dazed (skips the rest).
func _dim_update(delta: float) -> bool:
	if s.incapped or s.pinned_by != null:
		daze_t = 0.0
		return false
	daze_cd -= delta
	if daze_t > 0.0:
		daze_t -= delta
		s.move_dir = Vector3.ZERO
		s.yaw = wrapf(s.yaw + sin(Time.get_ticks_msec() * 0.0013) * delta * 0.8, -PI, PI)
		# Snaps out of it if something is right on him.
		if target and is_instance_valid(target) and target.global_position.distance_to(s.global_position) < 2.0:
			daze_t = 0.0
		return daze_t > 0.0
	var calm: bool = target == null or not is_instance_valid(target) or target.global_position.distance_to(s.global_position) > 10.0
	if calm and daze_cd <= 0.0:
		daze_cd = randf_range(18.0, 40.0)
		daze_t = randf_range(1.5, 4.0)
		if randf() < 0.6:
			Game.callout(s, DIM_LINES.pick_random())
		return true
	air_swing_t -= delta
	if calm and air_swing_t <= 0.0:
		air_swing_t = randf_range(8.0, 20.0)
		s.fire_held = true      # swings at a moth
	return false


# ------------------------------------------------------------------ targeting

func _scan() -> void:
	var lvl = Game.level
	var eye := s.eye_pos()
	var best = null
	var best_score := INF
	if forced_target and is_instance_valid(forced_target) and not forced_target.is_dead():
		if lvl.los(eye, forced_target.global_position) and eye.distance_to(forced_target.global_position) < 40.0:
			best = forced_target
			best_score = -100.0
	else:
		forced_target = null
	for z in Game.infected:
		if not is_instance_valid(z) or z.is_dead():
			continue
		var d: float = eye.distance_to(z.global_position)
		if d > 35.0:
			continue
		var score := d
		if z.is_special:
			if z.kind == "witch" and (z.phase == "idle" or z.phase == "agitated"):
				continue  # never startle the witch
			score -= 10.0
			if z.get("victim") != null:
				score -= 40.0
		elif z is Elite:
			score -= 14.0 if z.kind == "gunner" else 6.0
		elif z.state == Infected.S.IDLE or z.state == Infected.S.WANDER:
			score += 12.0
		elif z.state == Infected.S.ATTACK:
			score -= 5.0
		if score >= best_score:
			continue
		if not lvl.los(eye, z.global_position):
			continue
		best = z
		best_score = score
		if z.is_special and not spotted.has(z) and callout_cd <= 0.0 and z.kind != "witch":
			spotted[z] = true
			callout_cd = 3.0
			Game.callout(s, "%s!" % z.kind.capitalize())
	if best != target:
		target = best
		react_t = randf_range(0.55, 1.0) if dim else randf_range(0.18, 0.4)
		aim_err = Vector3(randf_range(-0.25, 0.25), randf_range(-0.2, 0.2), randf_range(-0.25, 0.25))


func _aim(delta: float) -> void:
	var eye := s.eye_pos()
	var aim_point: Vector3
	if target and is_instance_valid(target) and not target.is_dead():
		var h: float = target.head_y * 0.82 if not target.is_special else 1.1
		if target.kind == "tank":
			h = 1.6
		aim_point = target.global_position + Vector3(0, h, 0) + aim_err * clamp(eye.distance_to(target.global_position) / 15.0, 0.2, 1.0)
		aim_err = aim_err.move_toward(Vector3.ZERO, delta * 0.4)
	else:
		var look := s.move_dir if s.move_dir != Vector3.ZERO else s.flat_forward()
		aim_point = eye + look * 5.0
	var to := aim_point - eye
	var want_yaw := atan2(-to.x, -to.z)
	var want_pitch := atan2(to.y, Vector2(to.x, to.z).length())
	var turn := 7.0 * delta
	var dy := wrapf(want_yaw - s.yaw, -PI, PI)
	s.yaw = wrapf(s.yaw + clamp(dy, -turn, turn), -PI, PI)
	s.pitch = move_toward(s.pitch, want_pitch, turn * 0.7)


func _combat() -> void:
	# Keep the primary out unless we're down or holding something else on purpose.
	var prefer_melee: bool = (Game.mode == "sandbox" or s.primary == null) and WeaponData.get_def(s.secondary["id"]).get("melee", false)
	if prefer_melee and s.active_slot != Survivor.SLOT_SECONDARY and s.action == "" and not s.incapped:
		s.switch_to(Survivor.SLOT_SECONDARY)
	elif not prefer_melee and not s.incapped and s.action == "" and s.active_slot != Survivor.SLOT_PRIMARY and s.primary and s.active_slot != Survivor.SLOT_MEDKIT:
		s.switch_to(Survivor.SLOT_PRIMARY)
	if s.primary and s.primary["reserve"] < 20:
		s.primary["reserve"] = WeaponData.get_def(s.primary["id"])["reserve"]  # bots don't manage ammo
	if s.action != "" and not s.incapped:
		return
	if target == null or not is_instance_valid(target) or target.is_dead():
		var w = s.current_weapon()
		if w and not s.reloading and w["mag"] < WeaponData.get_def(w["id"]).get("mag", 0) * 0.5:
			s.start_reload()
		return
	if react_t > 0.0:
		return
	var eye := s.eye_pos()
	var to: Vector3 = (target.global_position + Vector3(0, 1.2, 0)) - eye
	var d := to.length()
	var err := s.aim_dir().angle_to(to / d)
	var tol: float = clamp(atan(0.6 / d) * 1.6, 0.04, 0.5)
	var def := s.current_def()
	if def.is_empty():
		return
	if def.get("melee", false):
		# Tap for lights; occasionally hold for a heavy into a crowd.
		if d < 2.6 and err < 0.7:
			var crowd := _commons_near(s.global_position + s.flat_forward() * 1.5, 2.0)
			if crowd >= 3:
				s.fire_held = Engine.get_physics_frames() % 40 < 30
			else:
				s.fire_held = Engine.get_physics_frames() % 2 == 0
		return
	if err < tol and d < def.get("range", 50.0):
		tap = not tap
		if tap or def.get("auto", false):
			s.trigger_released = true
		s.try_fire()
	# Shove commons that get in our face.
	var close := 0
	var fwd := s.flat_forward()
	for z in Game.infected:
		if is_instance_valid(z) and not z.is_dead() and not z.is_special:
			var o: Vector3 = z.global_position - s.global_position
			o.y = 0
			if o.length() < 1.5 and fwd.dot(o.normalized()) > 0.4:
				close += 1
	if close >= 2 or (close >= 1 and randf() < 0.08):
		s.try_shove()


# ------------------------------------------------------------------ movement

func _move(delta: float) -> void:
	var lvl = Game.level
	s.want_walk = false
	var goal = null      # Vector3 or null
	var use_leader_field := false
	# 1) Free pinned teammates.
	for t in Game.survivors:
		if t == s or not is_instance_valid(t) or t.dead or t.pinned_by == null:
			continue
		var d := s.global_position.distance_to(t.global_position)
		if d < 30.0:
			goal = t.global_position
			var p = t.pinned_by
			if d < 2.0 and is_instance_valid(p) and p.kind in ["hunter", "smoker", "jockey"]:
				var to: Vector3 = t.global_position - s.global_position
				s.yaw = atan2(-to.x, -to.z)
				s.try_shove()
			break
	# 2) Revive downed teammates when it's not suicidal.
	if goal == null:
		for t in Game.survivors:
			if t == s or not is_instance_valid(t) or t.dead or not t.incapped or t.pinned_by != null:
				continue
			if t.being_revived_by != null and t.being_revived_by != s:
				continue
			var threats := _commons_near(s.global_position, 3.5)
			if threats >= 3 and Game.difficulty >= Game.Diff.ADVANCED:
				continue
			goal = t.global_position
			if s.global_position.distance_to(t.global_position) < 1.5 and s.action == "":
				s.begin_action("revive", 5.0, t)
			break
	# 2b) Let a teammate out of a rescue closet nearby.
	if goal == null:
		for u in Game.usables:
			if u is Props.RescueCloset and is_instance_valid(u) and u.can_use(s) and u.global_position.distance_to(s.global_position) < 20.0:
				goal = u.global_position + u.outward * 0.8
				break
	if s.action == "revive":
		s.move_dir = Vector3.ZERO
		return
	# 3) Patch up.
	var calm := target == null or s.global_position.distance_to(target.global_position) > 15.0
	if s.action in ["heal_self", "pills", "heal_other", "use_hold"]:
		s.move_dir = Vector3.ZERO
		return
	if goal == null and calm and s.health < 40.0 and s.has_medkit:
		s.switch_to(Survivor.SLOT_MEDKIT)
		s.begin_action("heal_self", 5.0, s)
		return
	if s.total_health() < 45.0 and s.has_pills and s.action == "":
		s.begin_action("pills", 0.6, s)
	# 4) Objectives (autopilot) or follow the leader.
	if goal == null and autopilot:
		goal = _objective()
	var leader = Game.player
	if leader == null or not is_instance_valid(leader) or leader.dead or leader == s:
		leader = null
		for t in Game.survivors:
			if t != s and is_instance_valid(t) and not t.dead:
				leader = t
				break
	if goal == null and leader and not autopilot:
		var d: float = s.global_position.distance_to(leader.global_position)
		if d > 45.0 and not lvl.los(s.eye_pos(), leader.global_position):
			_teleport_near(leader)
		elif d > 4.0 or (lvl.in_end_room(leader.global_position) and not lvl.in_end_room(s.global_position)):
			goal = leader.global_position + follow_offset
			use_leader_field = true
	# 5) Opportunistic item pickups.
	item_t -= delta
	if goal == null or use_leader_field:
		var item = _wanted_item()
		if item and (calm or s.global_position.distance_to(item.global_position) < 3.0):
			goal = item.global_position
			use_leader_field = false
			if s.global_position.distance_to(item.global_position) < 1.6:
				item.on_use(s)
	# Steering
	var dir := Vector3.ZERO
	if goal != null:
		var to: Vector3 = goal - s.global_position
		to.y = 0
		var d := to.length()
		if d > 0.6:
			if use_leader_field and not lvl.los(s.global_position, goal):
				dir = lvl.field_player.direction(s.global_position)
			elif autopilot and not lvl.los(s.global_position, goal):
				dir = lvl.field_end.direction(s.global_position)
				if dir == Vector3.ZERO:
					dir = to / d
			else:
				dir = to / d
	# Give sleeping Witches a wide berth.
	var near_witch := false
	for z in Game.infected:
		if is_instance_valid(z) and z.kind == "witch" and (z.phase == "idle" or z.phase == "agitated"):
			var o: Vector3 = s.global_position - z.global_position
			o.y = 0
			var l := o.length()
			if l < 9.0 and l > 0.01:
				dir += o / l * (9.0 - l) / 9.0 * 2.5
				s.want_walk = true
				near_witch = true
	s.flashlight_enabled = not near_witch
	# Separation from teammates
	for t in Game.survivors:
		if t == s or not is_instance_valid(t) or t.dead:
			continue
		var o: Vector3 = s.global_position - t.global_position
		o.y = 0
		var l := o.length()
		if l < 1.2 and l > 0.01:
			dir += o / l * (1.2 - l) * 1.5
	# Unstick
	if jitter_t > 0.0:
		jitter_t -= delta
		dir = jitter_dir
	elif dir.length_squared() > 0.05:
		stuck_t += delta
		if stuck_t > 1.0:
			if s.global_position.distance_to(last_pos) < 0.5:
				jitter_t = 0.6
				jitter_dir = Vector3(randf_range(-1, 1), 0, randf_range(-1, 1)).normalized()
				s.want_jump = true
			stuck_t = 0.0
			last_pos = s.global_position
	s.move_dir = dir.normalized() if dir.length_squared() > 0.01 else Vector3.ZERO


func _commons_near(p: Vector3, r: float) -> int:
	var n := 0
	for z in Game.infected:
		if is_instance_valid(z) and not z.is_dead() and not z.is_special and z.global_position.distance_to(p) < r:
			n += 1
	return n


func _teleport_near(leader) -> void:
	var lvl = Game.level
	var c: Vector2i = lvl.cell_of(leader.global_position)
	for r in range(1, 4):
		for o in [Vector2i(r, 0), Vector2i(-r, 0), Vector2i(0, r), Vector2i(0, -r)]:
			var n: Vector2i = c + o
			if lvl.is_walkable_cell(n):
				s.global_position = lvl.cell_center(n) + Vector3(0, 0.2, 0)
				s.velocity = Vector3.ZERO
				return


func _wanted_item():
	if item_t > 0.0:
		return null
	item_t = 0.5
	var best = null
	var bd := 7.0
	for u in Game.usables:
		if not (u is Pickup) or not is_instance_valid(u) or not u.enabled:
			continue
		var d := s.global_position.distance_to(u.global_position)
		if d > bd:
			continue
		var id: String = u.item_id
		var want := false
		if id == "medkit":
			want = not s.has_medkit
		elif id == "pills":
			want = not s.has_pills
		elif WeaponData.THROWABLES.has(id):
			want = s.throwable == ""
		elif WeaponData.DEFS.has(id):
			var def := WeaponData.get_def(id)
			if def["slot"] == 0:
				var cur_tier: int = WeaponData.get_def(s.primary["id"])["tier"] if s.primary else -1
				want = def["tier"] > cur_tier
			elif id == "pistol":
				want = s.secondary["id"] == "pistol"
		if want:
			bd = d
			best = u
	return best


# ------------------------------------------------------------------ autopilot

func _objective():
	var lvl = Game.level
	var dir = Game.director
	if Game.mode == "sandbox":
		return lvl.cell_center(lvl.start_door)
	# Open the start door if it's closed and we're close.
	for u in Game.usables:
		if u is Props.Door and is_instance_valid(u) and not u.is_open and not u.is_end_door:
			if s.global_position.distance_to(u.global_position) < 2.5:
				u.on_use(s)
	if lvl.is_finale:
		if dir.finale_stage < 0:
			var radio = _find_usable(Props.Radio)
			if radio and radio.enabled:
				if s.global_position.distance_to(radio.global_position) < 2.0:
					s.begin_action("use_hold", radio.hold_time, radio)
				return radio.global_position
		if dir.rescue_arrived:
			return lvl.cell_center(lvl.rescue_rect.get_center())
		return lvl.cell_center(lvl.radio_cell)
	if lvl.gate_row >= 0 and not dir.gate_opened:
		var btn = _find_usable(Props.GateButton)
		if btn and btn.enabled:
			if s.global_position.distance_to(btn.global_position) < 2.0:
				btn.on_use(s)
			return btn.global_position
		return lvl.cell_center(lvl.gate_button_cell)
	if lvl.in_end_room(s.global_position):
		var all_in := true
		for t in Game.survivors:
			if is_instance_valid(t) and not t.dead and not lvl.in_end_room(t.global_position):
				all_in = false
		if all_in and lvl.end_door_node and lvl.end_door_node.is_open:
			lvl.end_door_node.on_use(s)
		return lvl.cell_center(lvl.end_room.get_center())
	return lvl.cell_center(lvl.end_room.get_center())


func _find_usable(cls):
	for u in Game.usables:
		if is_instance_valid(u) and is_instance_of(u, cls):
			return u
	return null
