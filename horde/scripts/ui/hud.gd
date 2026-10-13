class_name Hud
extends CanvasLayer
## In-game HUD and menus, built in code.

var root: Control
var crosshair: Crosshair
var team_box: VBoxContainer
var team_rows := {}
var weapon_label: Label
var ammo_label: Label
var slots_label: Label
var prompt_label: Label
var big_label: Label
var big_t := 0.0
var callouts: VBoxContainer
var progress: ProgressBar
var progress_label: Label
var debug_label: Label
var damage_rect: ColorRect
var _dmg_amt := 0.0
var bile_rect: ColorRect
var bw_rect: ColorRect
var hitmark: Label
var hitmark_t := 0.0
var map_label: Label
var markers: Array = []
var stamina_bar: StaminaPips
var ability_icon: AbilityIcon
var threat_ring: ThreatRing
var screen_splats: Array = []

var menu: Control
var menu_title: Label
var menu_body: Label
var menu_buttons: VBoxContainer
var scoreboard: Label


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	layer = 10
	root = Control.new()
	root.set_anchors_preset(Control.PRESET_FULL_RECT)
	root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(root)

	bw_rect = _shader_rect("""
shader_type canvas_item;
uniform sampler2D screen_tex : hint_screen_texture, filter_linear;
uniform float amount = 0.0;
void fragment() {
	vec3 c = texture(screen_tex, SCREEN_UV).rgb;
	float g = dot(c, vec3(0.3, 0.59, 0.11));
	COLOR = vec4(mix(c, vec3(g), amount), 1.0);
}""")
	bw_rect.visible = false
	# Edge vignette: red for health damage, pale blue when toughness soaks
	# the hit, strongest on the side the hit came from.
	damage_rect = _shader_rect("""
shader_type canvas_item;
uniform vec4 tint : source_color = vec4(0.6, 0.0, 0.0, 1.0);
uniform float amount = 0.0;
uniform float low = 0.0;
uniform vec2 dir = vec2(0.0);
void fragment() {
	vec2 p = UV * 2.0 - 1.0;
	float edge = smoothstep(0.55, 1.35, length(p * vec2(1.0, 0.8)));
	float side = 0.6 + 1.4 * max(dot(normalize(p + 1e-4), dir), 0.0) * length(dir);
	float a = clamp(amount * 0.5 * edge * side + low * edge, 0.0, 0.7);
	COLOR = vec4(tint.rgb, a);
}""")
	bile_rect = _overlay(Color(0.35, 0.5, 0.05, 0.0))

	crosshair = Crosshair.new()
	crosshair.set_anchors_preset(Control.PRESET_CENTER)
	root.add_child(crosshair)

	stamina_bar = StaminaPips.new()
	stamina_bar.set_anchors_preset(Control.PRESET_CENTER)
	stamina_bar.position = Vector2(0, 34)
	root.add_child(stamina_bar)

	threat_ring = ThreatRing.new()
	threat_ring.set_anchors_preset(Control.PRESET_CENTER)
	threat_ring.mouse_filter = Control.MOUSE_FILTER_IGNORE
	root.add_child(threat_ring)

	ability_icon = AbilityIcon.new()
	ability_icon.anchor_left = 0.5
	ability_icon.anchor_right = 0.5
	ability_icon.anchor_top = 1.0
	ability_icon.anchor_bottom = 1.0
	ability_icon.offset_top = -64
	root.add_child(ability_icon)

	hitmark = _label("x", 26, Color(1, 1, 1))
	hitmark.set_anchors_preset(Control.PRESET_CENTER)
	hitmark.position = Vector2(-8, -18)
	hitmark.modulate.a = 0.0

	team_box = VBoxContainer.new()
	team_box.position = Vector2(24, 0)
	team_box.anchor_top = 1.0
	team_box.anchor_bottom = 1.0
	team_box.offset_top = -210
	team_box.add_theme_constant_override("separation", 4)
	root.add_child(team_box)

	var wbox := VBoxContainer.new()
	wbox.anchor_left = 1.0
	wbox.anchor_right = 1.0
	wbox.anchor_top = 1.0
	wbox.anchor_bottom = 1.0
	wbox.offset_left = -360
	wbox.offset_top = -140
	wbox.offset_right = -24
	wbox.alignment = BoxContainer.ALIGNMENT_END
	root.add_child(wbox)
	weapon_label = _label("", 22, Color(0.9, 0.9, 0.85), wbox)
	weapon_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	ammo_label = _label("", 40, Color(1, 1, 1), wbox)
	ammo_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	slots_label = _label("", 15, Color(0.7, 0.7, 0.7), wbox)
	slots_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT

	prompt_label = _label("", 20, Color(1, 1, 0.85))
	prompt_label.set_anchors_preset(Control.PRESET_CENTER)
	prompt_label.position = Vector2(-300, 60)
	prompt_label.size = Vector2(600, 30)
	prompt_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER

	progress = ProgressBar.new()
	progress.set_anchors_preset(Control.PRESET_CENTER)
	progress.position = Vector2(-160, 100)
	progress.size = Vector2(320, 18)
	progress.show_percentage = false
	progress.visible = false
	root.add_child(progress)
	progress_label = _label("", 18, Color(1, 1, 1))
	progress_label.set_anchors_preset(Control.PRESET_CENTER)
	progress_label.position = Vector2(-160, 122)
	progress_label.size = Vector2(320, 24)
	progress_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER

	big_label = _label("", 44, Color(1, 1, 1))
	big_label.anchor_left = 0.0
	big_label.anchor_right = 1.0
	big_label.anchor_top = 0.22
	big_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	big_label.add_theme_constant_override("outline_size", 10)
	big_label.add_theme_color_override("font_outline_color", Color(0, 0, 0))

	map_label = _label("", 18, Color(0.85, 0.85, 0.8))
	map_label.position = Vector2(24, 18)

	callouts = VBoxContainer.new()
	callouts.anchor_top = 1.0
	callouts.anchor_bottom = 1.0
	callouts.anchor_left = 0.5
	callouts.offset_left = -400
	callouts.offset_right = 400
	callouts.offset_top = -260
	callouts.alignment = BoxContainer.ALIGNMENT_END
	callouts.mouse_filter = Control.MOUSE_FILTER_IGNORE
	root.add_child(callouts)

	debug_label = _label("", 15, Color(0.6, 1.0, 0.6))
	debug_label.anchor_left = 1.0
	debug_label.anchor_right = 1.0
	debug_label.offset_left = -420
	debug_label.offset_top = 16
	debug_label.visible = false

	scoreboard = _label("", 18, Color(1, 1, 1))
	scoreboard.set_anchors_preset(Control.PRESET_CENTER)
	scoreboard.position = Vector2(-330, -160)
	scoreboard.visible = false
	var sb_bg := StyleBoxFlat.new()
	sb_bg.bg_color = Color(0, 0, 0, 0.7)
	sb_bg.set_content_margin_all(18)
	scoreboard.add_theme_stylebox_override("normal", sb_bg)

	_build_menu()


func _label(t: String, size: int, col: Color, parent: Control = null) -> Label:
	var l := Label.new()
	l.text = t
	l.add_theme_font_size_override("font_size", size)
	l.add_theme_color_override("font_color", col)
	l.add_theme_constant_override("outline_size", 6)
	l.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.85))
	l.mouse_filter = Control.MOUSE_FILTER_IGNORE
	(parent if parent else root).add_child(l)
	return l


func _overlay(c: Color) -> ColorRect:
	var r := ColorRect.new()
	r.color = c
	r.set_anchors_preset(Control.PRESET_FULL_RECT)
	r.mouse_filter = Control.MOUSE_FILTER_IGNORE
	root.add_child(r)
	return r


func _shader_rect(code: String) -> ColorRect:
	var r := ColorRect.new()
	r.set_anchors_preset(Control.PRESET_FULL_RECT)
	r.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var sh := Shader.new()
	sh.code = code
	var m := ShaderMaterial.new()
	m.shader = sh
	r.material = m
	root.add_child(r)
	return r


# ================================================================== per frame

func _process(delta: float) -> void:
	big_t -= delta
	if big_t < 1.0:
		big_label.modulate.a = max(0.0, big_t)
	hitmark_t = max(0.0, hitmark_t - delta)
	hitmark.modulate.a = hitmark_t / 0.25
	for c in callouts.get_children():
		c.set_meta("t", c.get_meta("t") - delta)
		if c.get_meta("t") < 1.0:
			c.modulate.a = max(0.0, c.get_meta("t"))
		if c.get_meta("t") <= 0.0:
			c.queue_free()
	_update_markers(delta)
	var p = Game.player
	if not Game.playing or p == null or not is_instance_valid(p):
		root.visible = Game.playing
		return
	root.visible = true
	_update_team()
	_update_weapon(p)
	# Overlays
	var hurt: float = p.hurt_t / 0.3
	var low: float = 0.0
	if not p.dead and p.total_health() < 30.0 and not p.incapped:
		low = 0.15 + 0.08 * sin(Game.time * 6.0)
	if p.incapped:
		low = 0.3
	var dm := damage_rect.material as ShaderMaterial
	var tough: float = p.tough_hit_t / 0.3
	_dmg_amt = lerp(_dmg_amt, maxf(hurt, tough * 0.6), minf(1.0, delta * 14.0))
	dm.set_shader_parameter("amount", _dmg_amt * 0.9)
	dm.set_shader_parameter("low", low * 2.0)
	dm.set_shader_parameter("tint", Color(0.65, 0.0, 0.0) if hurt >= tough or low > 0.0 else Color(0.55, 0.75, 1.0))
	# Hit direction in screen space (x right, y down).
	var hd: Vector3 = p.last_hurt_dir
	var sd := Vector2.ZERO
	if hd.length_squared() > 0.01 and maxf(hurt, tough) > 0.0:
		var fwd: Vector3 = p.flat_forward()
		var right := fwd.cross(Vector3.UP)
		sd = Vector2(hd.dot(right), -hd.dot(fwd)).normalized()
	dm.set_shader_parameter("dir", sd)
	bile_rect.color.a = lerp(bile_rect.color.a, 0.45 if p.biled_time > 0.0 else 0.0, delta * 3.0)
	bw_rect.visible = p.is_black_and_white() or p.dead
	(bw_rect.material as ShaderMaterial).set_shader_parameter("amount", 1.0 if p.dead else 0.85)
	var melee_on: bool = p.is_melee_active() and p.active_slot == Survivor.SLOT_SECONDARY
	stamina_bar.visible = melee_on and not p.dead
	if melee_on:
		stamina_bar.value = p.melee.stamina
		stamina_bar.max_value = p.melee.ms.get("stamina", 4.0)
		stamina_bar.blocking = p.melee.is_blocking()
		stamina_bar.momentum = p.melee.momentum if p.melee.ms.get("momentum", false) else -1
		stamina_bar.charge = clamp(p.melee.t / p.melee.atk.get("charge", 1.0), 0.0, 1.0) if p.melee.state == "charge" else 0.0
		stamina_bar.queue_redraw()
	ability_icon.frac = 1.0 - p.ability_cd / p.ability_cooldown()
	ability_icon.label = p.ability_name()
	ability_icon.visible = not p.dead
	ability_icon.queue_redraw()
	_update_threats(p)
	_update_splats(delta)
	crosshair.visible = not p.dead and p.action == "" and p.active_slot <= Survivor.SLOT_SECONDARY
	crosshair.spread = _spread_of(p)
	crosshair.queue_redraw()
	# Prompt + progress
	var pc = p.controller
	prompt_label.text = pc.prompt_text() if pc and pc.has_method("prompt_text") and p.action == "" else ""
	if p.action != "":
		progress.visible = true
		progress.value = p.action_t / p.action_dur * 100.0
		progress_label.text = {"heal_self": "Healing yourself", "heal_other": "Healing teammate", "revive": "Reviving", "pills": "Taking pills", "use_hold": "Using", "self_revive": "Getting back up"}.get(p.action, p.action)
	elif p.being_revived_by != null and is_instance_valid(p.being_revived_by):
		progress.visible = true
		var r = p.being_revived_by
		progress.value = r.action_t / r.action_dur * 100.0
		progress_label.text = "Being revived by %s" % r.survivor_name
	elif p.incapped:
		progress.visible = true
		progress.value = p.incap_hp / 300.0 * 100.0
		progress_label.text = "INCAPACITATED - waiting for help" if Game.bots_enabled else "INCAPACITATED - hold E to get up"
	elif p.pinned_by != null:
		progress.visible = false
		progress_label.text = "PINNED - your team has to save you!"
	else:
		progress.visible = false
		progress_label.text = ""
	if Game.director:
		debug_label.visible = Game.debug_overlay
		if Game.debug_overlay:
			debug_label.text = Game.director.debug_text()
	scoreboard.visible = Input.is_action_pressed("scoreboard") and Input.mouse_mode == Input.MOUSE_MODE_CAPTURED
	if scoreboard.visible:
		scoreboard.text = stats_text()


func _spread_of(p) -> float:
	var def: Dictionary = p.current_def()
	if def.is_empty() or def.get("melee", false):
		return 2.0
	var s: float = def.get("spread", 1.0)
	if Vector2(p.velocity.x, p.velocity.z).length() > 1.0:
		s *= 1.6
	if p.want_crouch:
		s *= 0.6
	s += p.spread_bloom
	return s * 7.0 + 6.0


func _update_team() -> void:
	for s in Game.survivors:
		if not is_instance_valid(s):
			continue
		if not team_rows.has(s):
			var row := TeamRow.new()
			row.s = s
			team_box.add_child(row)
			team_rows[s] = row
		team_rows[s].queue_redraw()
	for s in team_rows.keys():
		if not is_instance_valid(s):
			team_rows[s].queue_free()
			team_rows.erase(s)


func _update_weapon(p) -> void:
	var id: String = p.current_item_id()
	weapon_label.text = WeaponData.display_name(id) if id != "" else ""
	var w = p.current_weapon()
	if w:
		var def := WeaponData.get_def(w["id"])
		if def.get("melee", false):
			ammo_label.text = ""
		elif w["reserve"] < 0:
			ammo_label.text = "%d  /  ∞" % w["mag"]
		else:
			ammo_label.text = "%d  /  %d" % [w["mag"], w["reserve"]]
		if p.reloading:
			ammo_label.text = "Reloading..."
	else:
		ammo_label.text = ""
	var slots := []
	var names := ["1 " + (WeaponData.display_name(p.primary["id"]) if p.primary else "-"), "2 " + WeaponData.display_name(p.secondary["id"]),
		"3 " + (WeaponData.display_name(p.throwable) if p.throwable != "" else "-"), "4 " + ("Medkit" if p.has_medkit else "-"), "5 " + ("Pills" if p.has_pills else "-")]
	for i in 5:
		slots.append(("[%s]" % names[i]) if i == p.active_slot else names[i])
	slots_label.text = "   ".join(slots)


# ================================================================== events

## Brief full-screen tint (perfect block, full charge).
func flash(col: Color, dur: float) -> void:
	var r := ColorRect.new()
	r.color = col
	r.set_anchors_preset(Control.PRESET_FULL_RECT)
	r.mouse_filter = Control.MOUSE_FILTER_IGNORE
	root.add_child(r)
	var tw := r.create_tween()
	tw.tween_property(r, "color:a", 0.0, dur)
	tw.tween_callback(r.queue_free)


## Darktide-style gore on the screen after a close kill.
func screen_blood() -> void:
	if screen_splats.size() > 5:
		return
	var tr := TextureRect.new()
	tr.texture = Mats.screen_spray(randi() % 4)
	tr.stretch_mode = TextureRect.STRETCH_SCALE
	var sz := randf_range(150, 290)
	tr.size = Vector2(sz, sz)
	var vp := root.get_viewport_rect().size
	# Toward the edges, sprayed inward from the side it lands on.
	var left := randf() < 0.5
	var x := randf_range(-sz * 0.35, vp.x * 0.22) if left else randf_range(vp.x * 0.78 - sz, vp.x - sz * 0.65)
	tr.position = Vector2(x, randf_range(-sz * 0.2, vp.y * 0.65))
	tr.pivot_offset = tr.size * 0.5
	tr.rotation = (0.0 if left else PI) + randf_range(-0.6, 0.6)
	tr.modulate = Color(1, 1, 1, 0.9)
	tr.mouse_filter = Control.MOUSE_FILTER_IGNORE
	root.add_child(tr)
	root.move_child(tr, 3)
	screen_splats.append([tr, 1.8])


func _update_splats(delta: float) -> void:
	for sp in screen_splats.duplicate():
		sp[1] -= delta
		var tr: TextureRect = sp[0]
		tr.modulate.a = clamp(sp[1] / 1.1, 0.0, 0.9)
		tr.position.y += delta * 14.0     # drips down
		tr.scale.y = 1.0 + (1.8 - sp[1]) * 0.12
		if sp[1] <= 0.0:
			tr.queue_free()
			screen_splats.erase(sp)


## Attacks winding up on the player from outside the view: red chevrons
## around the crosshair pointing at the attacker (Darktide-style).
func _update_threats(p) -> void:
	var list := []
	var fwd: Vector3 = p.flat_forward()
	var right := fwd.cross(Vector3.UP)
	for z in Game.infected:
		if not is_instance_valid(z) or z.is_dead() or z.attack_pending <= 0.0 or z.target != p:
			continue
		var to: Vector3 = z.global_position - p.global_position
		to.y = 0.0
		if to.length() > 4.0 or to.length() < 0.01:
			continue
		to = to.normalized()
		if fwd.dot(to) > 0.6:
			continue        # in plain view
		# Screen angle: 0 = up (ahead), clockwise to the right.
		var ang := atan2(right.dot(to), fwd.dot(to))
		list.append([ang, clampf(z.attack_pending / 0.4, 0.0, 1.0), z is Elite])
	threat_ring.threats = list
	threat_ring.queue_redraw()


var help_panel: Label

const MELEE_HELP := """MELEE  (H hides this)
LMB tap: light chain  ·  LMB hold: charged heavy
RMB: block  ·  RMB + LMB: push  ·  push, then LMB: push-attack
Space while strafing/backing: dodge  (dodge an attack = slow-mo + riposte)
Shift: sprint  ·  Ctrl while sprinting: slide
V / MMB: weapon special  (sabre parry, messer wrath cut)
G: class ability  ·  T: swap blade (sandbox)"""

func toggle_help(show := -1) -> void:
	if help_panel == null:
		help_panel = Label.new()
		help_panel.text = MELEE_HELP
		help_panel.add_theme_font_size_override("font_size", 15)
		help_panel.add_theme_color_override("font_color", Color(0.95, 0.92, 0.85))
		help_panel.add_theme_constant_override("outline_size", 5)
		help_panel.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.85))
		help_panel.position = Vector2(24, 70)
		root.add_child(help_panel)
		help_panel.visible = false
	help_panel.visible = (not help_panel.visible) if show < 0 else show == 1
	help_panel.modulate.a = 1.0


## "x4" tally under the crosshair when one swing kills several.
func multi_kill(n: int) -> void:
	var l := Label.new()
	l.text = "x%d" % n
	l.add_theme_font_size_override("font_size", 22 + 3 * mini(n, 8))
	l.add_theme_color_override("font_color", Color(1.0, 0.85 - 0.05 * mini(n, 8), 0.6 - 0.06 * mini(n, 8)))
	l.add_theme_constant_override("outline_size", 6)
	l.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.8))
	l.set_anchors_preset(Control.PRESET_CENTER)
	l.position = Vector2(26, 8)
	root.add_child(l)
	l.scale = Vector2(1.6, 1.6)
	var tw := l.create_tween()
	tw.tween_property(l, "scale", Vector2.ONE, 0.12).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	tw.tween_interval(0.5)
	tw.tween_property(l, "modulate:a", 0.0, 0.35)
	tw.tween_callback(l.queue_free)


func big_message(t: String, col := Color.WHITE, dur := 3.0) -> void:
	big_label.text = t
	big_label.add_theme_color_override("font_color", col)
	big_label.modulate.a = 1.0
	big_t = dur


func add_callout(who: String, t: String, col := Color.WHITE) -> void:
	var l := Label.new()
	l.text = ("%s: %s" % [who, t]) if who != "" else t
	l.add_theme_font_size_override("font_size", 18)
	l.add_theme_color_override("font_color", col.lightened(0.3))
	l.add_theme_constant_override("outline_size", 6)
	l.add_theme_color_override("font_outline_color", Color(0, 0, 0))
	l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	l.set_meta("t", 4.0)
	callouts.add_child(l)
	while callouts.get_child_count() > 5:
		callouts.get_child(0).free()
	if Game.autotest:
		print("[callout] ", l.text)


func hit_marker(killed: bool, head: bool) -> void:
	hitmark_t = 0.25
	hitmark.add_theme_color_override("font_color", Color(1, 0.3, 0.2) if killed else (Color(1, 0.9, 0.3) if head else Color(1, 1, 1)))


func ping_marker(target: Node3D) -> void:
	var l := Label3D.new()
	l.text = "▼ " + str(target.get("kind")).to_upper()
	l.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	l.no_depth_test = true
	l.fixed_size = true
	l.pixel_size = 0.0013
	l.font_size = 26
	l.outline_size = 8
	l.modulate = Color(1, 0.35, 0.25)
	l.position.y = 2.6
	target.add_child(l)
	markers.append([l, 6.0])


func ping_point(p: Vector3) -> void:
	var l := Label3D.new()
	l.text = "◆"
	l.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	l.no_depth_test = true
	l.fixed_size = true
	l.pixel_size = 0.0015
	l.font_size = 30
	l.modulate = Color(0.4, 0.9, 1.0)
	Game.world.add_child(l)
	l.global_position = p + Vector3(0, 0.3, 0)
	markers.append([l, 5.0])


func _update_markers(delta: float) -> void:
	for m in markers.duplicate():
		m[1] -= delta
		if m[1] <= 0.0 or not is_instance_valid(m[0]):
			if is_instance_valid(m[0]):
				m[0].queue_free()
			markers.erase(m)


func stats_text() -> String:
	var lines := ["%-10s %6s %8s %6s %6s %8s" % ["", "Kills", "Specials", "Heads", "FF", "Revives"]]
	for s in Game.survivors:
		if is_instance_valid(s):
			var st: Dictionary = s.stats
			lines.append("%-10s %6d %8d %6d %6d %8d" % [s.survivor_name, st["kills"], st["specials"], st["headshots"], int(st["ff"]), st["revives"]])
	return "\n".join(lines)


# ================================================================== menus

func _build_menu() -> void:
	menu = PanelContainer.new()
	menu.set_anchors_preset(Control.PRESET_FULL_RECT)
	var bg := StyleBoxFlat.new()
	bg.bg_color = Color(0.03, 0.02, 0.02, 0.88)
	menu.add_theme_stylebox_override("panel", bg)
	add_child(menu)
	var center := CenterContainer.new()
	menu.add_child(center)
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", 14)
	v.custom_minimum_size = Vector2(640, 0)
	center.add_child(v)
	menu_title = Label.new()
	menu_title.add_theme_font_size_override("font_size", 64)
	menu_title.add_theme_color_override("font_color", Color(0.85, 0.15, 0.1))
	menu_title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	v.add_child(menu_title)
	menu_body = Label.new()
	menu_body.add_theme_font_size_override("font_size", 17)
	menu_body.add_theme_color_override("font_color", Color(0.85, 0.85, 0.8))
	menu_body.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	menu_body.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	v.add_child(menu_body)
	menu_buttons = VBoxContainer.new()
	menu_buttons.add_theme_constant_override("separation", 8)
	v.add_child(menu_buttons)


func show_menu(title: String, body: String, buttons: Array) -> void:
	menu.visible = true
	menu_title.text = title
	menu_body.text = body
	for c in menu_buttons.get_children():
		c.queue_free()
	for b in buttons:
		var btn := Button.new()
		btn.text = b[0]
		btn.custom_minimum_size = Vector2(0, 44)
		btn.add_theme_font_size_override("font_size", 20)
		btn.pressed.connect(b[1])
		menu_buttons.add_child(btn)
	Input.mouse_mode = Input.MOUSE_MODE_VISIBLE


func hide_menu() -> void:
	menu.visible = false


func reset() -> void:
	for r in team_rows.values():
		r.queue_free()
	team_rows.clear()
	for c in callouts.get_children():
		c.queue_free()
	big_t = 0.0
	big_label.text = ""


# ================================================================== widgets

class Crosshair extends Control:
	var spread := 10.0
	func _draw() -> void:
		var c := Color(1, 1, 1, 0.85)
		var g := spread
		var l := 8.0
		draw_line(Vector2(-g - l, 0), Vector2(-g, 0), c, 2.0)
		draw_line(Vector2(g, 0), Vector2(g + l, 0), c, 2.0)
		draw_line(Vector2(0, -g - l), Vector2(0, -g), c, 2.0)
		draw_line(Vector2(0, g), Vector2(0, g + l), c, 2.0)
		draw_circle(Vector2.ZERO, 1.5, c)


## Combat ability (G): ring fills while recharging, glows when ready.
class ThreatRing extends Control:
	var threats := []
	func _draw() -> void:
		for t in threats:
			var ang: float = t[0]
			# Brighter as the hit gets closer to landing.
			var a: float = 1.0 - float(t[1]) * 0.6
			var col := Color(1.0, 0.85, 0.2, a) if t[2] else Color(1.0, 0.15, 0.1, a)
			var d := Vector2(sin(ang), -cos(ang))
			var c := d * 95.0
			var side := Vector2(-d.y, d.x)
			var pts := PackedVector2Array([c + d * 16.0, c - side * 14.0, c + d * 6.0, c + side * 14.0])
			draw_colored_polygon(pts, col)


class AbilityIcon extends Control:
	var frac := 1.0
	var label := ""
	func _draw() -> void:
		var ready := frac >= 1.0
		var c := Vector2(0, 22)
		draw_circle(c, 20.0, Color(0, 0, 0, 0.45))
		draw_arc(c, 20.0, -PI / 2, -PI / 2 + TAU * frac, 32, Color(1.0, 0.8, 0.45, 0.95) if ready else Color(1, 1, 1, 0.5), 3.0)
		var font := ThemeDB.fallback_font
		draw_string(font, c + Vector2(-6, 7), "G", HORIZONTAL_ALIGNMENT_LEFT, -1, 20, Color(1, 0.9, 0.7) if ready else Color(1, 1, 1, 0.4))
		draw_string(font, c + Vector2(-80, 40), label, HORIZONTAL_ALIGNMENT_CENTER, 160, 13, Color(1, 1, 1, 0.6))


class StaminaPips extends Control:
	var momentum := -1
	var value := 4.0
	var max_value := 4.0
	var blocking := false
	var charge := 0.0
	func _draw() -> void:
		var n := int(round(max_value))
		var w := 16.0
		var gap := 4.0
		var total := n * w + (n - 1) * gap
		for i in n:
			var fill: float = clamp(value - i, 0.0, 1.0)
			var r := Rect2(-total * 0.5 + i * (w + gap), 0, w, 4)
			draw_rect(r, Color(1, 1, 1, 0.2))
			var c := Color(1.0, 0.85, 0.4, 0.9) if blocking else Color(1, 1, 1, 0.75)
			draw_rect(Rect2(r.position, Vector2(w * fill, 4)), c)
		if momentum >= 0:
			# Momentum chevrons under the stamina pips.
			for i in 5:
				var x := -40.0 + i * 20.0
				var on := i < momentum
				var c := Color(1.0, 0.55, 0.2, 0.95) if on else Color(1, 1, 1, 0.15)
				draw_polyline(PackedVector2Array([Vector2(x - 5, 12), Vector2(x, 17), Vector2(x + 5, 12)]), c, 2.0)
		if charge > 0.0:
			draw_arc(Vector2(0, -34), 14.0, -PI / 2, -PI / 2 + TAU * charge, 24, Color(1, 0.9, 0.6, 0.9), 2.0)


class TeamRow extends Control:
	var s
	func _init() -> void:
		custom_minimum_size = Vector2(320, 44)
	func _draw() -> void:
		if s == null or not is_instance_valid(s):
			return
		var font := ThemeDB.fallback_font
		draw_rect(Rect2(0, 0, 320, 44), Color(0, 0, 0, 0.45))
		draw_rect(Rect2(0, 0, 5, 44), s.color)
		var status := ""
		if s.dead:
			status = "DEAD"
		elif s.pinned_by != null:
			status = "PINNED"
		elif s.incapped:
			status = "DOWN"
		elif s.is_black_and_white():
			status = "B&W"
		elif s.biled_time > 0.0:
			status = "BILED"
		draw_string(font, Vector2(12, 18), s.survivor_name + ("" if s.is_bot else " (you)"), HORIZONTAL_ALIGNMENT_LEFT, -1, 16, Color(1, 1, 1))
		draw_string(font, Vector2(200, 18), status, HORIZONTAL_ALIGNMENT_LEFT, -1, 15, Color(1, 0.35, 0.3))
		var items := ""
		if s.has_medkit:
			items += "+ "
		if s.has_pills:
			items += "o "
		if s.throwable != "":
			items += "* "
		draw_string(font, Vector2(270, 18), items, HORIZONTAL_ALIGNMENT_LEFT, -1, 15, Color(0.9, 0.9, 0.9))
		var w := 300.0
		if not s.dead and not s.incapped:
			draw_rect(Rect2(12, 22, w, 3), Color(0.1, 0.12, 0.18))
			draw_rect(Rect2(12, 22, w * clamp(s.toughness / s.toughness_max, 0.0, 1.0), 3), Color(0.45, 0.7, 1.0) if s.coherency > 0 else Color(0.35, 0.5, 0.75))
		draw_rect(Rect2(12, 26, w, 10), Color(0.15, 0.15, 0.15))
		if s.incapped:
			draw_rect(Rect2(12, 26, w * s.incap_hp / 300.0, 10), Color(0.8, 0.15, 0.1))
		elif not s.dead:
			var hcol := Color(0.3, 0.8, 0.3)
			if s.health < 40:
				hcol = Color(0.9, 0.7, 0.2)
			if s.health < 25:
				hcol = Color(0.9, 0.25, 0.2)
			draw_rect(Rect2(12, 26, w * clamp(s.health / 100.0, 0.0, 1.0), 10), hcol)
			draw_rect(Rect2(12 + w * clamp(s.health / 100.0, 0.0, 1.0), 26, w * clamp(s.temp_health / 100.0, 0.0, 1.0), 10), Color(0.85, 0.85, 0.85))
