class_name Survivor
extends CharacterBody3D
## A survivor: the player or a bot. Controllers (PlayerController, BotBrain)
## only set intent (move_dir, yaw/pitch, buttons); this script owns movement,
## weapons, health, incapacitation and being pinned.

const RUN_SPEED := 5.2
const SPRINT_SPEED := 7.2
const WALK_SPEED := 2.4
const CROUCH_SPEED := 1.9
const EYE := 1.6
const SLOT_PRIMARY := 0
const SLOT_SECONDARY := 1
const SLOT_THROW := 2
const SLOT_MEDKIT := 3
const SLOT_PILLS := 4

var survivor_name := "Survivor"
var color := Color.WHITE
var is_bot := true
var controller = null
var rig: Rig
var held_model: Node3D
var name_tag: Label3D
var flashlight: SpotLight3D
var flashlight_enabled := true

# intent (written by controllers)
var move_dir := Vector3.ZERO
var want_walk := false
var want_crouch := false
var want_jump := false
var yaw := 0.0
var pitch := 0.0

# health
var health := 100.0
var temp_health := 0.0
var incapped := false
var incap_hp := 300.0
var incap_count := 0
var dead := false
var pinned_by = null
var ride_vel := Vector3.ZERO     # a jockey steering us
var biled_time := 0.0
var slow_t := 0.0
var stun_t := 0.0
var hurt_t := 0.0
var tough_hit_t := 0.0    # toughness soaked a hit (HUD edge flash)
var last_hurt_dir := Vector3.ZERO
var being_revived_by = null
var in_safe_room := false
# Darktide-style toughness: absorbs damage first, regenerates when you're
# not taking hits (faster near teammates), and melee kills refill it.
var toughness := 100.0
var toughness_max := 100.0
var toughness_delay := 0.0
var coherency := 0

# inventory
var primary: Variant = null                # {id, mag, reserve} or null
var secondary := {"id": "pistol", "mag": 15, "reserve": -1}
var throwable := ""
var has_medkit := false
var has_pills := false
var active_slot := SLOT_SECONDARY
var last_slot := SLOT_PRIMARY

# weapon timing
var fire_cd := 0.0
var reload_t := 0.0
var reloading := false
var deploy_t := 0.0
var shove_cd := 0.0
var shove_fatigue := 0.0
var spread_bloom := 0.0
var trigger_released := true
var fire_held := false          # set every frame by the controller (melee reads held/press)
var block_held := false
var melee: Melee
var want_dodge := false
var want_sprint := false
var sprinting := false
var slide_t := 0.0            # sliding (crouch while sprinting)
var slide_v := Vector3.ZERO
var riposte_t := 0.0          # after a perfect dodge: next melee hit counters
var dodge_dir := Vector3.ZERO
var want_ability := false
var ability_cd := 8.0
var survivor_class := "zealot"
var buff_t := 0.0               # Volley Fire active
var rush_t := 0.0               # Bull Rush active
var rush_dir := Vector3.ZERO
var rush_hit := {}
var burst_target = null         # Brain Burst charging on this enemy
var burst_t := 0.0
# Darktide-style classes: [display name, ability name, cooldown]
const CLASSES := {
	"zealot": ["Zealot", "Battle Cry", 30.0],
	"veteran": ["Veteran", "Volley Fire", 30.0],
	"ogryn": ["Ogryn", "Bull Rush", 20.0],
	"psyker": ["Psyker", "Brain Burst", 16.0],
}
const CLASS_ORDER := ["zealot", "veteran", "ogryn", "psyker"]


func ability_cooldown() -> float:
	return CLASSES[survivor_class][2]


func ability_name() -> String:
	return CLASSES[survivor_class][1]
var dodge_t := 0.0
var dodge_cd := 0.0
var dodges := 3
var dodge_regen := 0.0

# timed actions: heal_self, heal_other, revive, pills, use_hold
var action := ""
var action_t := 0.0
var action_dur := 1.0
var action_target = null

var stats := {"kills": 0, "specials": 0, "headshots": 0, "ff": 0, "damage_taken": 0, "revives": 0, "incaps": 0}

signal fired(def: Dictionary)
signal hurt(amount: float, from_dir: Vector3)


func setup(n: String, c: Color, bot: bool) -> void:
	survivor_name = n
	color = c
	is_bot = bot


func _ready() -> void:
	collision_layer = Game.LAYER_SURVIVOR
	collision_mask = Game.LAYER_WORLD | Game.LAYER_SURVIVOR | Game.LAYER_INFECTED
	floor_snap_length = 0.3
	var cs := CollisionShape3D.new()
	var cap := CapsuleShape3D.new()
	cap.radius = 0.48   # personal space: keeps enemy heads out of the camera
	cap.height = 1.8
	cs.shape = cap
	cs.position.y = 0.9
	add_child(cs)
	if Game.melee_only:
		primary = null
		if WeaponData.is_gun(secondary["id"]):
			secondary = WeaponData.new_state("fire_axe" if is_bot else "greatsword")
		active_slot = SLOT_SECONDARY
	_make_rig()
	melee = Melee.new(self)
	_refresh_held_model()
	if not Game.survivors.has(self):
		Game.survivors.append(self)


func _make_rig() -> void:
	var models := {"Reyes": "knight", "Okafor": "barbarian", "Mags": "rogue_hooded", "Dutch": "adv_mage"}
	var hair := {"Reyes": ["Hair_SimpleParted", "Hair_Beard"], "Okafor": ["Hair_Buzzed"], "Mags": ["Hair_Buns"], "Dutch": ["Hair_Long", "Hair_Beard"]}
	rig = SkinnedRig.create(models.get(survivor_name, "knight"), {"role": "survivor",
		"top": color.darkened(0.35), "bottom": Color(0.17, 0.18, 0.2), "hair": hair.get(survivor_name, []),
		"hair_color": {"Reyes": Color(0.16, 0.11, 0.08), "Okafor": Color(0.08, 0.07, 0.06), "Mags": Color(0.45, 0.22, 0.12), "Dutch": Color(0.4, 0.36, 0.3)}.get(survivor_name, Color(0.2, 0.15, 0.1))})
	add_child(rig)
	rig.set_pose("aim")
	if is_bot:
		name_tag = Label3D.new()
		name_tag.billboard = BaseMaterial3D.BILLBOARD_ENABLED
		name_tag.no_depth_test = true
		name_tag.fixed_size = true
		name_tag.pixel_size = 0.0011
		name_tag.font_size = 24
		name_tag.outline_size = 8
		name_tag.position.y = 2.15
		name_tag.modulate = color.lightened(0.3)
		add_child(name_tag)
		flashlight = SpotLight3D.new()
		flashlight.spot_range = 20.0
		flashlight.spot_angle = 22.0
		flashlight.light_energy = 2.0
		flashlight.light_color = Color(1.0, 0.95, 0.85)
		flashlight.position = Vector3(0.15, 1.45, -0.3)
		rig.add_child(flashlight)


func _exit_tree() -> void:
	Game.survivors.erase(self)


# ================================================================== helpers

func eye_pos() -> Vector3:
	var h := EYE
	if incapped:
		h = 0.55
	elif want_crouch:
		h = 1.1
	return global_position + Vector3(0, h, 0)


func aim_dir() -> Vector3:
	return Vector3(-sin(yaw) * cos(pitch), sin(pitch), -cos(yaw) * cos(pitch))


func flat_forward() -> Vector3:
	return Vector3(-sin(yaw), 0, -cos(yaw))


func total_health() -> float:
	return health + temp_health


func is_black_and_white() -> bool:
	return incap_count >= 2


func can_act() -> bool:
	return not dead and pinned_by == null and stun_t <= 0.0


func flashlight_on() -> bool:
	return flashlight_enabled


func current_weapon() -> Variant:
	match active_slot:
		SLOT_PRIMARY:
			return primary
		SLOT_SECONDARY:
			return secondary
	return null


func current_def() -> Dictionary:
	var w: Variant = current_weapon()
	if w == null:
		return {}
	return WeaponData.get_def(w["id"])


func current_item_id() -> String:
	match active_slot:
		SLOT_PRIMARY: return primary["id"] if primary else ""
		SLOT_SECONDARY: return secondary["id"]
		SLOT_THROW: return throwable
		SLOT_MEDKIT: return "medkit" if has_medkit else ""
		SLOT_PILLS: return "pills" if has_pills else ""
	return ""


func has_slot(slot: int) -> bool:
	match slot:
		SLOT_PRIMARY: return primary != null
		SLOT_SECONDARY: return true
		SLOT_THROW: return throwable != ""
		SLOT_MEDKIT: return has_medkit
		SLOT_PILLS: return has_pills
	return false


func switch_to(slot: int) -> void:
	if slot == active_slot or not has_slot(slot) or incapped or action != "":
		return
	if slot != active_slot:
		last_slot = active_slot
	active_slot = slot
	reloading = false
	reload_t = 0.0
	deploy_t = 0.45
	_refresh_held_model()
	if controller and controller.has_method("on_weapon_changed"):
		controller.on_weapon_changed()


func cycle_weapon(dir: int) -> void:
	var s := active_slot
	for i in 5:
		s = posmod(s + dir, 5)
		if has_slot(s):
			switch_to(s)
			return


func _refresh_held_model() -> void:
	if held_model:
		held_model.queue_free()
		held_model = null
	var id := current_item_id()
	if id == "" or rig == null or not is_instance_valid(rig):
		return
	if rig is SkinnedRig:
		rig.melee_held = WeaponData.DEFS.has(id) and WeaponData.get_def(id).get("melee", false)
	held_model = WeaponData.build_model(id)
	rig.held.add_child(held_model)


# ================================================================== loop

func _physics_process(delta: float) -> void:
	if dead:
		if is_instance_valid(rig):   # a ragdolled corpse is freed after a while
			rig.animate(delta, 0.0)
		return
	if controller:
		controller.update(delta)
	_timers(delta)
	ability_cd = maxf(0.0, ability_cd - delta)
	buff_t = maxf(0.0, buff_t - delta)
	_update_brain_burst(delta)
	if want_ability:
		want_ability = false
		use_ability()
	_update_melee(delta)
	_move(delta)
	_update_action(delta)
	_update_visuals(delta)


func is_melee_active() -> bool:
	return current_def().get("melee", false)


var melee_frozen := false   # pose contact sheet holds the pose

var _coh_t := 0.0

func _update_toughness(delta: float) -> void:
	_coh_t -= delta
	if _coh_t <= 0.0:
		_coh_t = 0.5
		coherency = 0
		for o in Game.survivors:
			if o != self and is_instance_valid(o) and not o.dead and o.global_position.distance_to(global_position) < 8.0:
				coherency += 1
	if incapped or dead:
		return
	toughness_delay -= delta
	if toughness_delay <= 0.0:
		var rate := 5.0 + 5.0 * coherency
		toughness = min(toughness_max, toughness + rate * delta)


## Battle Cry (combat ability): a shout that knocks down or staggers every
## enemy within 6.5 m and refills the toughness of everyone in coherency.
func use_ability() -> bool:
	if ability_cd > 0.0 or incapped or dead or pinned_by != null:
		return false
	var ok := false
	match survivor_class:
		"veteran": ok = _volley_fire()
		"ogryn": ok = _bull_rush()
		"psyker": ok = _brain_burst()
		_: ok = _battle_cry()
	if ok:
		ability_cd = ability_cooldown()
		if Game.autotest:
			print("[autotest] %s used %s" % [survivor_name, ability_name()])
		if controller and controller.has_method("on_ability"):
			controller.on_ability()
	return ok


func _battle_cry() -> bool:
	var p := global_position
	for z in Game.infected.duplicate():
		if not is_instance_valid(z) or z.is_dead() or z.kind == "witch" or z.kind == "tank":
			continue
		var away: Vector3 = z.global_position - p
		away.y = 0.0
		if away.length() > 6.5:
			continue
		if z.kind == "common":
			z.knockdown(away, randf_range(1.2, 2.2))
		else:
			z.melee_stagger(away.normalized(), 9.0)
	for o in Game.survivors:
		if is_instance_valid(o) and not o.dead and o.global_position.distance_to(p) < 8.0:
			o.restore_toughness(o.toughness_max)
	Game.sfx.play3d("charger_roar", eye_pos(), 4.0, 0.05)
	Game.sfx.play3d("tank_punch", p + Vector3(0, 0.3, 0), 0.0, 0.1)
	Game.fx.shockwave(p + Vector3(0, 0.15, 0), 6.5)
	Game.fx.add_shake(p, 0.5)
	Game.make_noise(p, 20.0)
	Game.callout(self, ["Get back!", "Come on then!", "Back off!"].pick_random())
	return true


## Veteran: 8 s of faster, harder-hitting fire, a fresh magazine, and every
## special and elite in sight marked for the team.
func _volley_fire() -> bool:
	buff_t = 8.0
	var w: Variant = current_weapon()
	if w != null and WeaponData.DEFS.has(w["id"]) and not WeaponData.get_def(w["id"]).get("melee", false):
		w["mag"] = WeaponData.get_def(w["id"]).get("mag", w["mag"])
		reloading = false
	for z in Game.infected:
		if is_instance_valid(z) and not z.is_dead() and (z.is_special or z is Elite):
			if z.global_position.distance_to(global_position) < 45.0 and Game.level.los(eye_pos(), z.global_position + Vector3(0, 1, 0)):
				Game.hud.ping_marker(z)
	Game.sfx.play3d("reload", eye_pos(), 2.0, 0.0)
	Game.callout(self, ["Targets marked!", "Volley fire!", "Eyes on!"].pick_random())
	return true


## Ogryn: a short charge that bowls the horde over.
func _bull_rush() -> bool:
	rush_t = 0.55
	rush_dir = flat_forward()
	rush_hit.clear()
	Game.sfx.play3d("charger_roar", eye_pos(), 2.0, 0.1)
	Game.callout(self, ["Coming through!", "Out the way!"].pick_random())
	return true


func _update_rush() -> void:
	for z in Game.infected.duplicate():
		if not is_instance_valid(z) or z.is_dead() or rush_hit.has(z):
			continue
		var to: Vector3 = z.global_position - global_position
		to.y = 0.0
		if to.length() < 1.7 and rush_dir.dot(to.normalized()) > -0.2:
			rush_hit[z] = true
			var side := rush_dir * 0.6 + to.normalized() * 0.8
			if z.kind == "common":
				z.knockdown(side, randf_range(1.0, 1.8))
				z.take_damage(25.0, self, "body", "melee", z.global_position + Vector3(0, 1, 0))
			elif z.kind != "tank":
				z.melee_stagger(side.normalized(), 9.0)
			Game.sfx.play3d("bone", z.global_position + Vector3(0, 1, 0), -4.0, 0.2)
			Game.fx.add_shake(global_position, 0.15)


## Psyker: pick the special/elite under the crosshair (else any enemy); its
## head swells for a moment, then pops.
func _brain_burst() -> bool:
	var eye := eye_pos()
	var fwd := aim_dir()
	var best = null
	var best_score := -INF
	for z in Game.infected:
		if not is_instance_valid(z) or z.is_dead():
			continue
		var head: Vector3 = z.global_position + Vector3(0, z.head_y, 0)
		var to := head - eye
		var d := to.length()
		if d > 50.0 or d < 1.0:
			continue
		var dot := fwd.dot(to / d)
		if dot < 0.96:
			continue
		var score := dot * 10.0 - d * 0.02 + (3.0 if z.is_special or z is Elite else 0.0)
		if score > best_score and Game.level.los(eye, head):
			best_score = score
			best = z
	if best == null:
		return false
	burst_target = best
	burst_t = 0.7
	Game.sfx.play3d("smoker_cough", eye, -6.0, 0.3)
	return true


func _update_brain_burst(delta: float) -> void:
	if burst_target == null:
		return
	if not is_instance_valid(burst_target) or burst_target.is_dead() or dead or incapped:
		burst_target = null
		return
	burst_t -= delta
	if randf() < delta * 30.0:
		Game.fx.impact(burst_target.global_position + Vector3(0, burst_target.head_y, 0), Vector3.UP)
	if burst_t <= 0.0:
		var z = burst_target
		burst_target = null
		z.cut = "split"
		z.impact_dir = Vector3.UP
		z.impact_force = 3.0
		var dmg := 260.0 if z.kind == "tank" else 900.0
		z.take_damage(dmg, self, "head", "melee", z.global_position + Vector3(0, z.head_y, 0))
		Game.sfx.play3d("flesh", z.global_position + Vector3(0, 1.6, 0), 4.0, 0.1)
		Game.fx.gib_burst(z.global_position + Vector3(0, z.head_y, 0), Vector3.UP, 0.25)


## Slipped an attack mid-dodge: a beat of slow motion, stamina back, and
## the next melee hit within the window is a counter.
func _perfect_dodge(attacker) -> void:
	if riposte_t > 0.5:
		return
	riposte_t = 1.0
	dodges = mini(dodges + 1, 3)
	restore_toughness(8.0)
	if is_melee_active():
		melee.stamina = minf(melee.ms["stamina"], melee.stamina + 0.5)
	if controller and controller.has_method("on_perfect_dodge"):
		controller.on_perfect_dodge(attacker)


func restore_toughness(amount: float) -> void:
	toughness = min(toughness_max, toughness + amount)


func _update_melee(delta: float) -> void:
	if melee_frozen:
		melee._update_view_roll(delta)
		return
	if is_melee_active() and can_act() and not incapped and action == "":
		melee.set_weapon(current_item_id())
		melee.update(delta, fire_held and deploy_t <= 0.0, block_held)
	elif melee.state != "idle":
		melee.reset()


func _timers(delta: float) -> void:
	fire_cd = max(0.0, fire_cd - delta)
	deploy_t = max(0.0, deploy_t - delta)
	shove_cd = max(0.0, shove_cd - delta)
	shove_fatigue = max(0.0, shove_fatigue - delta * 0.8)
	slow_t = max(0.0, slow_t - delta)
	stun_t = max(0.0, stun_t - delta)
	hurt_t = max(0.0, hurt_t - delta)
	tough_hit_t = max(0.0, tough_hit_t - delta)
	spread_bloom = max(0.0, spread_bloom - delta * 6.0)
	if biled_time > 0.0:
		biled_time -= delta
	if temp_health > 0.0:
		temp_health = max(0.0, temp_health - 0.27 * delta)
	_update_toughness(delta)
	if incapped and pinned_by == null:
		incap_hp -= delta * (3.0 if being_revived_by == null else 0.0)
		if incap_hp <= 0.0:
			die()
			return
	if reloading:
		reload_t -= delta
		if reload_t <= 0.0:
			_finish_reload_step()


var _last_delta := 0.016

func _move(delta: float) -> void:
	_last_delta = delta
	if rush_t > 0.0 and pinned_by == null and not incapped:
		rush_t -= _last_delta
		velocity = rush_dir * 13.0 + Vector3(0, velocity.y - 20.0 * _last_delta, 0)
		move_and_slide()
		_update_rush()
		if is_on_wall():
			rush_t = 0.0
			Game.fx.add_shake(global_position, 0.4)
		return
	if pinned_by != null:
		velocity = Vector3.ZERO
		if ride_vel != Vector3.ZERO:
			velocity = ride_vel + Vector3(0, -2.0, 0)
			move_and_slide()
		return
	var speed := RUN_SPEED
	var busy_melee: bool = is_melee_active() and melee.state not in ["idle", "recover"]
	sprinting = want_sprint and is_on_floor() and not want_crouch and not busy_melee and stun_t <= 0.0 \
		and not incapped and action == "" and not reloading and move_dir != Vector3.ZERO
	riposte_t = maxf(0.0, riposte_t - delta)
	# Slide: crouch while sprinting carries you forward low and fast.
	if want_crouch and (sprinting or (want_sprint and slide_t <= 0.0 and Vector2(velocity.x, velocity.z).length() > 6.0)) and slide_t <= 0.0 and is_on_floor():
		slide_t = 0.75
		slide_v = Vector3(velocity.x, 0, velocity.z).normalized() * 9.0
		Game.sfx.play3d("step", global_position, -2.0, 0.1)
		if controller and controller.has_method("on_slide"):
			controller.on_slide()
	if slide_t > 0.0:
		slide_t -= delta
		if not want_crouch:
			slide_t = minf(slide_t, 0.08)
		var k := clampf(slide_t / 0.75, 0.0, 1.0)
		var v := slide_v * (0.35 + 0.65 * k) + move_dir * 1.2 + melee.lunge
		velocity.x = v.x
		velocity.z = v.z
		velocity.y = -0.5 if is_on_floor() else velocity.y - 14.0 * delta
		move_and_slide()
		if is_on_wall():
			slide_t = 0.0
		return
	if sprinting:
		speed = SPRINT_SPEED
	if incapped or action in ["heal_self", "heal_other", "revive", "use_hold"]:
		speed = 0.0
	elif want_crouch:
		speed = CROUCH_SPEED
	elif want_walk:
		speed = WALK_SPEED
	if health < 40.0 and temp_health <= 0.0 and not incapped:
		speed *= 0.72
	if slow_t > 0.0:
		speed *= 0.7
	if stun_t > 0.0:
		speed = 0.0
	if is_melee_active():
		speed *= melee.move_mult()
	var target_v := move_dir * speed + melee.lunge
	var hv := Vector3(velocity.x, 0, velocity.z)
	var a := 40.0 if is_on_floor() else 6.0
	if stun_t > 0.0:
		a = 3.0
	# Dodge: a quick side/back hop that commons' swings whiff through.
	dodge_t = max(0.0, dodge_t - delta)
	dodge_cd = max(0.0, dodge_cd - delta)
	dodge_regen += delta
	if dodge_regen > 1.0 and dodges < 3:
		dodges = 3
	if want_dodge and is_on_floor() and dodge_cd <= 0.0 and dodges > 0 and stun_t <= 0.0 and not incapped and move_dir != Vector3.ZERO:
		dodges -= 1
		dodge_regen = 0.0
		dodge_t = 0.34
		dodge_cd = 0.2
		dodge_dir = move_dir
		hv = move_dir * 10.5
		# Dodging cancels a windup or the tail of a swing (never the cut itself).
		if is_melee_active() and melee.state in ["windup", "charge", "follow", "recover"]:
			melee.cancel()
		Game.sfx.play3d("whoosh", eye_pos(), -8.0, 0.15)
		if controller and controller.has_method("on_dodge"):
			controller.on_dodge(move_dir)
	want_dodge = false
	if dodge_t > 0.0:
		# A grounded dash: fast out, easing to a stop.
		a = 0.0
		var dk := dodge_t / 0.34
		hv = dodge_dir * (2.5 + 8.0 * dk * dk)
	hv = hv.move_toward(target_v, a * delta)
	velocity.x = hv.x
	velocity.z = hv.z
	if is_on_floor():
		if want_jump and not incapped and stun_t <= 0.0:
			velocity.y = 4.8
		else:
			velocity.y = -0.5
	else:
		velocity.y -= 14.0 * delta
	want_jump = false
	move_and_slide()


func _update_visuals(delta: float) -> void:
	rig.rotation.y = yaw
	if incapped:
		rig.set_pose("incap")
	elif pinned_by != null:
		rig.set_pose("pinned")
	elif want_crouch:
		rig.set_pose("crouch")
	else:
		rig.set_pose("aim")
	rig.animate(delta, Vector2(velocity.x, velocity.z).length())
	if flashlight:
		flashlight.visible = flashlight_enabled
		flashlight.rotation.x = pitch
	if name_tag:
		var hp_txt := "DOWN" if incapped else str(int(ceil(total_health())))
		name_tag.text = "%s\n%s" % [survivor_name, hp_txt]
		var c := color.lightened(0.3)
		if incapped or pinned_by != null:
			c = Color(1, 0.25, 0.2)
		elif total_health() < 40:
			c = Color(1, 0.75, 0.3)
		name_tag.modulate = c


# ================================================================== weapons

func try_fire() -> void:
	if not can_act() or deploy_t > 0.0 or action != "":
		return
	if is_melee_active() and active_slot == SLOT_SECONDARY:
		fire_held = true   # the Melee state machine handles light/heavy timing
		return
	match active_slot:
		SLOT_THROW:
			_throw()
			return
		SLOT_MEDKIT:
			return
		SLOT_PILLS:
			if has_pills:
				begin_action("pills", 0.6, self)
			return
	var w: Variant = current_weapon()
	if w == null:
		return
	var def := WeaponData.get_def(w["id"])
	if incapped and active_slot != SLOT_SECONDARY:
		return
	if fire_cd > 0.0:
		return
	if not def.get("auto", false) and not trigger_released and not def.get("melee", false):
		return
	trigger_released = false
	if reloading:
		if def.get("shell_reload", false) and w["mag"] > 0:
			reloading = false
		else:
			return
	if w["mag"] <= 0:
		Game.sfx.play3d("dry_fire", eye_pos(), -8.0)
		fire_cd = 0.25
		start_reload()
		return
	w["mag"] -= 1
	fire_cd = def["rate"] * (0.75 if buff_t > 0.0 else 1.0)
	var origin := eye_pos()
	var base := aim_dir()
	var spread_deg: float = def["spread"]
	var moving := Vector2(velocity.x, velocity.z).length() > 1.0
	if moving:
		spread_deg *= 1.6
	if want_crouch and not moving:
		spread_deg *= 0.6
	if not is_on_floor():
		spread_deg *= 2.5
	if incapped:
		spread_deg *= 1.5
	spread_deg += spread_bloom
	if is_bot:
		spread_deg *= 1.2
	var aim_basis := Basis.looking_at(base, Vector3.UP)
	var pellets: int = def.get("pellets", 1)
	var end_points := []
	for i in pellets:
		var ang := deg_to_rad(spread_deg) * sqrt(randf())
		var rot := randf() * TAU
		var local := Vector3(sin(ang) * cos(rot), sin(ang) * sin(rot), -cos(ang))
		var dir := (aim_basis * local).normalized()
		end_points.append(_hitscan(origin, dir, def))
	spread_bloom = min(spread_bloom + (0.6 if def.get("auto", false) else 1.2), 4.0)
	Game.sfx.play3d(def["sound"], origin, 0.0 if not is_bot else -4.0, 0.06)
	Game.make_noise(global_position, def.get("noise", 25.0))
	var muzzle := origin + base * 0.6 + Vector3(0, -0.15, 0)
	if controller and controller.has_method("muzzle_point"):
		muzzle = controller.muzzle_point()
	Game.fx.muzzle_flash(muzzle, base)
	for p in end_points:
		if randf() < (0.5 if pellets > 1 else 1.0):
			Game.fx.tracer(muzzle, p)
	fired.emit(def)
	if w["mag"] <= 0 and (w["reserve"] != 0):
		start_reload()


func _hitscan(origin: Vector3, dir: Vector3, def: Dictionary) -> Vector3:
	var space := get_world_3d().direct_space_state
	var rng_m: float = def.get("range", 60.0)
	var pen: int = def.get("pen", 1)
	var exclude: Array[RID] = [get_rid()]
	var mask := Game.LAYER_WORLD | Game.LAYER_INFECTED
	if not is_bot:
		mask |= Game.LAYER_SURVIVOR
	var from := origin
	var to := origin + dir * rng_m
	var dmg: float = def["damage"] * (1.4 if buff_t > 0.0 else 1.0)
	var hits := 0
	for step in 8:
		var q := PhysicsRayQueryParameters3D.create(from, to, mask, exclude)
		var hit := space.intersect_ray(q)
		if hit.is_empty():
			return to
		var col = hit["collider"]
		var p: Vector3 = hit["position"]
		if col is Infected:
			var dist := origin.distance_to(p)
			var falloff := 1.0
			if def.get("pellets", 1) > 1 and dist > 12.0:
				falloff = clamp(1.0 - (dist - 12.0) / 20.0, 0.2, 1.0)
			var part: String = col.hit_part(p)
			if part == "head" and not is_bot:
				stats["headshots"] += 0  # counted on kill
			col.take_damage(dmg * falloff, self, part, "bullet", p)
			if not is_bot and controller and controller.has_method("hit_marker"):
				controller.hit_marker(col.is_dead(), part == "head")
			hits += 1
			if hits >= pen or col.is_special:
				return p
			exclude.append(col.get_rid())
			from = p
			continue
		if col is Survivor:
			if col != self and not col.dead:
				var ff := dmg * Game.ff_mult()
				if ff > 0.0:
					col.take_damage(ff, self, "ff")
					stats["ff"] += ff
					if randf() < 0.4:
						Game.callout(col, ["Watch your fire!", "Hey! Quit it!", "Friendly fire!"].pick_random())
			return p
		# World hit
		Game.fx.impact(p, hit["normal"])
		if not is_bot and col is Node and col.has_meta("alarm"):
			col.get_meta("alarm").trigger()
		return p
	return to


func start_reload() -> void:
	var w: Variant = current_weapon()
	if w == null or reloading or action != "":
		return
	var def := WeaponData.get_def(w["id"])
	if def.get("melee", false):
		return
	if w["mag"] >= def["mag"]:
		return
	if w["reserve"] == 0:
		return
	reloading = true
	reload_t = def["reload"]
	Game.sfx.play3d("reload", eye_pos(), -10.0)
	if controller and controller.has_method("on_reload"):
		controller.on_reload(def)
	if is_bot and randf() < 0.25:
		Game.callout(self, "Reloading!")


func _finish_reload_step() -> void:
	var w: Variant = current_weapon()
	if w == null:
		reloading = false
		return
	var def := WeaponData.get_def(w["id"])
	var need: int = def["mag"] - w["mag"]
	if def.get("shell_reload", false):
		if need > 0 and (w["reserve"] > 0 or w["reserve"] < 0):
			w["mag"] += 1
			if w["reserve"] > 0:
				w["reserve"] -= 1
			Game.sfx.play3d("shell", eye_pos(), -12.0)
			if w["mag"] < def["mag"] and w["reserve"] != 0:
				reload_t = def["reload"]
				return
		reloading = false
		return
	if w["reserve"] < 0:
		w["mag"] = def["mag"]
	else:
		var take: int = min(need, w["reserve"])
		w["mag"] += take
		w["reserve"] -= take
	reloading = false


func try_shove() -> void:
	if not can_act() or incapped or shove_cd > 0.0 or action != "":
		return
	shove_fatigue += 1.0
	shove_cd = 0.7 if shove_fatigue < 4.0 else 1.4
	rig.swing(0.3)
	if controller and controller.has_method("on_shove"):
		controller.on_shove()
	Game.sfx.play3d("swing", eye_pos(), -8.0, 0.1)
	var fwd := flat_forward()
	var hit_any := false
	for z in Game.infected.duplicate():
		if not is_instance_valid(z) or z.is_dead():
			continue
		var to: Vector3 = z.global_position - global_position
		to.y = 0
		var d := to.length()
		if d < 2.1 and d > 0.01 and fwd.dot(to / d) > 0.45:
			z.shove(global_position, self)
			hit_any = true
	# Knock specials off teammates.
	for s in Game.survivors:
		if s == self or not is_instance_valid(s) or s.pinned_by == null:
			continue
		var to: Vector3 = s.global_position - global_position
		to.y = 0
		if to.length() < 2.2 and fwd.dot(to.normalized()) > 0.3:
			var p = s.pinned_by
			if is_instance_valid(p) and p.has_method("shoved_off"):
				p.shoved_off(self)
				hit_any = true
	if hit_any:
		Game.sfx.play3d("melee_hit", eye_pos() + fwd, -6.0, 0.2)


func _throw() -> void:
	if throwable == "":
		return
	var t := Throwable.create(throwable, self)
	Game.world.add_child(t)
	t.global_position = eye_pos() + aim_dir() * 0.5
	t.linear_velocity = aim_dir() * 15.0 + Vector3(0, 3.0, 0) + velocity * 0.5
	t.angular_velocity = Vector3(randf_range(-8, 8), randf_range(-8, 8), randf_range(-8, 8))
	Game.callout(self, {"pipe_bomb": "Pipe bomb out!", "molotov": "Throwing a molotov!", "bile_jar": "Bile jar out!"}.get(throwable, "Fire in the hole!"))
	throwable = ""
	fire_cd = 0.8
	active_slot = last_slot if has_slot(last_slot) else SLOT_SECONDARY
	_refresh_held_model()
	if controller and controller.has_method("on_weapon_changed"):
		controller.on_weapon_changed()


# ================================================================== items

func can_take(id: String) -> bool:
	match id:
		"ammo":
			if primary == null:
				return false
			var d := WeaponData.get_def(primary["id"])
			return primary["reserve"] < d["reserve"]
		"medkit": return not has_medkit
		"pills": return not has_pills
	return true


## Gives the item; returns the id that should be left lying in the world ("" = nothing).
func take_item(id: String) -> String:
	var left := ""
	if id == "ammo":
		var d := WeaponData.get_def(primary["id"])
		primary["reserve"] = d["reserve"]
		return ""
	if id == "medkit":
		has_medkit = true
		return ""
	if id == "pills":
		has_pills = true
		return ""
	if WeaponData.THROWABLES.has(id):
		left = throwable
		throwable = id
		_refresh_held_model()
		return left
	var def := WeaponData.get_def(id)
	if def["slot"] == 0:
		if primary and primary["id"] == id:
			primary["reserve"] = def["reserve"]
			return id
		left = primary["id"] if primary else ""
		primary = WeaponData.new_state(id)
		if not incapped:
			active_slot = SLOT_PRIMARY
	else:
		if id == "pistol" and secondary["id"] == "pistol":
			secondary = WeaponData.new_state("dual_pistols")
			left = ""
		else:
			left = secondary["id"]
			if left == "dual_pistols":
				left = "pistol"
			secondary = WeaponData.new_state(id)
		if not incapped:
			active_slot = SLOT_SECONDARY
	reloading = false
	deploy_t = 0.5
	_refresh_held_model()
	if controller and controller.has_method("on_weapon_changed"):
		controller.on_weapon_changed()
	return left


# ================================================================== timed actions

func begin_action(kind: String, dur: float, target) -> void:
	if action != "" or not can_act():
		return
	if incapped and kind != "use_hold" and kind != "self_revive":
		return
	action = kind
	action_t = 0.0
	action_dur = dur
	action_target = target
	reloading = false
	if kind == "revive" and target:
		target.being_revived_by = self
		Game.callout(self, ["I got you!", "Hang on, I'm here.", "Up you get."].pick_random())
	elif kind == "heal_self" or kind == "heal_other":
		Game.sfx.play3d("heal", eye_pos(), -6.0)


func cancel_action() -> void:
	if action == "revive" and action_target and is_instance_valid(action_target):
		if action_target.being_revived_by == self:
			action_target.being_revived_by = null
	action = ""
	action_t = 0.0
	action_target = null


func _update_action(delta: float) -> void:
	if action == "":
		return
	if not can_act() or (incapped and action != "use_hold" and action != "self_revive"):
		cancel_action()
		return
	var t = action_target
	if action in ["revive", "heal_other"]:
		if t == null or not is_instance_valid(t) or t.dead or global_position.distance_to(t.global_position) > 2.3:
			cancel_action()
			return
		if action == "revive" and (not t.incapped or t.pinned_by != null):
			cancel_action()
			return
	if action == "use_hold" and (t == null or not is_instance_valid(t)):
		cancel_action()
		return
	action_t += delta
	if action_t < action_dur:
		return
	var done := action
	action = ""
	action_target = null
	match done:
		"heal_self":
			_apply_medkit(self)
		"heal_other":
			_apply_medkit(t)
			Game.callout(t, "Thanks!")
		"revive":
			t.being_revived_by = null
			t.revive()
			stats["revives"] += 1
		"pills":
			has_pills = false
			temp_health = min(100.0 - health, temp_health + 50.0)
			Game.sfx.play3d("pills", eye_pos(), -6.0)
			active_slot = last_slot if has_slot(last_slot) else SLOT_SECONDARY
			_refresh_held_model()
		"use_hold":
			t.on_use(self)
		"self_revive":
			revive()


func _apply_medkit(who) -> void:
	has_medkit = false
	who.health = who.health + (100.0 - who.health) * 0.8
	who.temp_health = 0.0
	who.incap_count = 0
	if active_slot == SLOT_MEDKIT:
		active_slot = last_slot if has_slot(last_slot) else SLOT_SECONDARY
		_refresh_held_model()
		if controller and controller.has_method("on_weapon_changed"):
			controller.on_weapon_changed()


# ================================================================== damage

func take_damage(amount: float, attacker = null, kind := "") -> void:
	if dead or amount <= 0.0:
		return
	if Game.autotest and not is_bot and kind != "ff":
		amount *= 0.25  # keep the soak test running longer
	if dodge_t > 0.0 and kind in ["claw", "shot"]:
		_perfect_dodge(attacker)
		return  # dodged
	if is_melee_active() and not incapped:
		amount = melee.block_hit(amount, attacker, kind)
		if amount <= 0.0:
			return
	if Game.god_mode and not is_bot:
		hurt_t = 0.15
		return
	stats["damage_taken"] += amount
	hurt_t = 0.3
	if attacker and is_instance_valid(attacker) and attacker is Node3D:
		last_hurt_dir = (attacker.global_position - global_position).normalized()
	if kind == "claw" and randf() < 0.5:
		slow_t = 0.4
	if incapped:
		incap_hp -= amount
		if incap_hp <= 0.0:
			die()
		hurt.emit(amount, last_hurt_dir)
		return
	# Toughness soaks most hits first (not pins, acid, fire or bleed-outs).
	if kind in ["claw", "punch", "rock", "charge", "pounce", "explosion", "shot", ""] and toughness > 0.0:
		var soaked: float = min(toughness, amount)
		if soaked >= amount * 0.99:
			hurt_t = 0.0          # fully covered: the HUD flashes toughness, not blood
			tough_hit_t = 0.3
		toughness -= soaked
		amount -= soaked * 0.85      # a little damage bleeds through
		toughness_delay = 3.0
		if toughness <= 0.0 and controller and controller.has_method("on_toughness_broken"):
			controller.on_toughness_broken()
		if amount <= 0.01:
			hurt.emit(soaked, last_hurt_dir)
			return
	else:
		toughness_delay = 3.0
	if kind == "incap":
		health = 0.0
		temp_health = 0.0
	else:
		var from_temp: float = min(temp_health, amount)
		temp_health -= from_temp
		health -= amount - from_temp
	if Game.director:
		Game.director.add_intensity(self, amount / 60.0)
	if randf() < 0.3:
		Game.sfx.play3d("pain", eye_pos(), -6.0, 0.15)
	hurt.emit(amount, last_hurt_dir)
	if health <= 0.0 and temp_health <= 0.0:
		if incap_count >= 2:
			die()
		else:
			incapacitate()


func incapacitate() -> void:
	incapped = true
	incap_hp = 300.0
	health = 0.0
	temp_health = 0.0
	stats["incaps"] += 1
	cancel_action()
	reloading = false
	if active_slot != SLOT_SECONDARY:
		active_slot = SLOT_SECONDARY
		_refresh_held_model()
		if controller and controller.has_method("on_weapon_changed"):
			controller.on_weapon_changed()
	Game.sfx.play3d("incap", eye_pos(), 0.0)
	Game.callout(self, ["I'm down!", "Help me up!", "I'm hit bad!"].pick_random())
	if Game.director:
		Game.director.add_intensity(self, 1.0)
		Game.director.check_wipe()


func revive() -> void:
	if not incapped or dead:
		return
	incapped = false
	toughness = toughness_max * 0.5
	health = 1.0
	temp_health = 30.0
	incap_count += 1
	stun_t = 0.5
	if is_black_and_white():
		Game.callout(self, "I can't take much more of this...")


func die() -> void:
	if dead:
		return
	dead = true
	incapped = false
	cancel_action()
	if pinned_by and is_instance_valid(pinned_by) and pinned_by.has_method("release_pin"):
		pinned_by.release_pin()
	pinned_by = null
	if rig.visible and is_bot:
		rig.ragdoll(velocity, -flat_forward() * 6.0 + Vector3(0, 2, 0), global_position + Vector3(0, 1, 0), "")
	else:
		rig.die(flat_forward())
	if name_tag:
		name_tag.visible = false
	if flashlight:
		flashlight.visible = false
	collision_layer = 0
	Game.sfx.play3d("death", eye_pos(), 0.0)
	if Game.hud:
		Game.hud.add_callout("", "%s has died." % survivor_name, Color(1, 0.3, 0.3))
	if Game.director:
		Game.director.check_wipe()
		Game.director.on_survivor_died(self)


## Rescued from a closet: back on your feet with a pistol and half health.
func respawn_at(pos: Vector3, facing: Vector3) -> void:
	if not dead:
		return
	if is_instance_valid(rig):
		rig.queue_free()
	if name_tag:
		name_tag.queue_free()
		name_tag = null
	flashlight = null
	_make_rig()
	dead = false
	incapped = false
	incap_count = 0
	health = 50.0
	temp_health = 0.0
	toughness = toughness_max
	collision_layer = Game.LAYER_SURVIVOR
	primary = null
	secondary = WeaponData.new_state("machete" if Game.melee_only else "pistol")
	active_slot = SLOT_SECONDARY
	velocity = Vector3.ZERO
	global_position = pos
	yaw = atan2(-facing.x, -facing.z)
	_refresh_held_model()
	Game.callout(self, ["Thanks for getting me out!", "About time!", "I owe you one."].pick_random())


func knockback(v: Vector3, stun := 0.8) -> void:
	if dead or pinned_by != null:
		return
	velocity = v
	stun_t = stun
	cancel_action()


func pin(by, _kind: String) -> void:
	pinned_by = by
	cancel_action()
	reloading = false
	stats["damage_taken"] += 0
	if Game.director:
		Game.director.add_intensity(self, 0.6)
		Game.director.check_wipe()
	Game.callout(self, {"hunter": "Hunter on me!", "smoker": "Smoker's got me!", "charger": "Charger!", "jockey": "Jockey! Get it off me!"}.get(_kind, "Help!"))


func unpin() -> void:
	pinned_by = null
	stun_t = 0.6


func apply_bile(t: float) -> void:
	biled_time = max(biled_time, t)
	if Game.director:
		Game.director.on_biled(self)


func add_kill(z, headshot: bool) -> void:
	stats["kills"] += 1
	if is_melee_active():
		restore_toughness(15.0 if z.is_special or z is Elite else 5.0)
	if z.is_special:
		stats["specials"] += 1
	if headshot:
		stats["headshots"] += 1
	if Game.director:
		Game.director.add_intensity(self, 0.02)


# ================================================================== carry-over between maps

func export_state() -> Dictionary:
	return {
		"primary": primary.duplicate() if primary else null, "secondary": secondary.duplicate(),
		"throwable": throwable, "medkit": has_medkit, "pills": has_pills,
		"health": max(health, 50.0) if dead else max(health, 1.0), "temp": temp_health if not dead else 0.0,
		"dead": dead,
	}


func import_state(s: Dictionary) -> void:
	primary = s["primary"]
	secondary = s["secondary"]
	if Game.melee_only:
		primary = null
		if WeaponData.is_gun(secondary["id"]):
			secondary = WeaponData.new_state("greatsword")
	throwable = s["throwable"]
	has_medkit = s["medkit"]
	has_pills = s["pills"]
	health = s["health"]
	temp_health = s["temp"]
	if s["dead"]:
		health = 50.0
	incap_count = 0
	active_slot = SLOT_PRIMARY if primary else SLOT_SECONDARY
	_refresh_held_model()
