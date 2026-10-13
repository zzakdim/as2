class_name PlayerController
extends Node3D
## First-person input, camera, flashlight and viewmodel for the human player.

var s: Survivor
var camera: Camera3D
var flashlight: SpotLight3D
var vm_root: Node3D
var vm_model: Node3D
var vm_kick := 0.0
var vm_reload := 0.0
var vm_shove := 0.0
var vm_melee := 0.0
var bob_t := 0.0
var land_dip := 0.0
var look_target = null       # current usable / teammate under crosshair
var hold_kind := ""
var _was_on_floor := true
var _mouse_delta := Vector2.ZERO
var base_fov := 85.0
# Melee viewmodel: the blade is posed directly from Melee.pose (camera space)
var melee_root: Node3D
var melee_blade_mat: StandardMaterial3D
var arm_parts: Array = []      # [upper_r, fore_r, hand_r, upper_l, fore_l, hand_l]
var fp_arms: FPArms           # realistic IK arms (falls back to box forearms)
var trail: MeshInstance3D
var trail_mesh: ImmediateMesh
var trail_pts: Array = []      # [base, tip, age] in camera space
var dodge_roll := 0.0
var hit_shake := 0.0


func attach(surv: Survivor) -> void:
	s = surv
	s.controller = self
	s.is_bot = false
	s.add_child(self)


func _ready() -> void:
	camera = Camera3D.new()
	camera.fov = base_fov
	camera.near = 0.1
	camera.far = 400.0
	camera.current = true
	s.add_child(camera)
	camera.position = Vector3(0, Survivor.EYE, 0)
	flashlight = SpotLight3D.new()
	flashlight.spot_range = 32.0
	flashlight.spot_angle = 26.0
	flashlight.spot_angle_attenuation = 0.7
	flashlight.light_energy = 3.2
	flashlight.light_color = Color(1.0, 0.96, 0.88)
	flashlight.shadow_enabled = true
	flashlight.position = Vector3(0.25, -0.15, 0.0)
	camera.add_child(flashlight)
	vm_root = Node3D.new()
	camera.add_child(vm_root)
	# Viewmodel fill light: keeps the held weapon readable in the dark
	# (metal reflects nothing against a black sky otherwise).
	var vm_light := OmniLight3D.new()
	vm_light.light_color = Color(1.0, 0.9, 0.8)
	vm_light.light_energy = 0.6
	vm_light.omni_range = 2.2
	vm_light.position = Vector3(0.3, 0.25, 0.2)
	vm_light.light_specular = 1.5
	camera.add_child(vm_light)
	s.rig.visible = false
	if FPArms.available() and SkinnedRig.style == "human" and not Infected.use_box_rigs:
		fp_arms = FPArms.new()
		camera.add_child(fp_arms)
		fp_arms.setup(s.color.darkened(0.35))
	s.fired.connect(_on_fired)
	on_weapon_changed()


func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventMouseMotion and Input.mouse_mode == Input.MOUSE_MODE_CAPTURED:
		_mouse_delta += event.relative


func update(delta: float) -> void:
	# Look
	var sens: float = Game.mouse_sensitivity
	s.yaw = wrapf(s.yaw - _mouse_delta.x * sens, -PI, PI)
	s.pitch = clamp(s.pitch - _mouse_delta.y * sens, -1.45, 1.45)
	_mouse_delta = Vector2.ZERO

	var playing: bool = Input.mouse_mode == Input.MOUSE_MODE_CAPTURED or Game.force_input
	# Move
	var mv := Vector2.ZERO
	if playing:
		mv = Input.get_vector("move_left", "move_right", "move_forward", "move_back")
	var fwd := s.flat_forward()
	var right := Vector3(-fwd.z, 0, fwd.x)
	var dir := right * mv.x - fwd * mv.y
	s.move_dir = dir.normalized() if dir.length_squared() > 0.01 else Vector3.ZERO
	s.want_walk = playing and Input.is_action_pressed("walk")
	s.want_crouch = playing and Input.is_action_pressed("crouch")
	if playing and Input.is_action_just_pressed("jump"):
		# Darktide-style: jump while moving sideways/backwards is a dodge.
		if mv.length() > 0.3 and mv.y > -0.3:
			s.want_dodge = true
		else:
			s.want_jump = true
	if not playing:
		s.fire_held = false
		s.block_held = false
		return

	if Input.is_action_just_pressed("flashlight"):
		s.flashlight_enabled = not s.flashlight_enabled
		Game.sfx.play2d("dry_fire", -10.0)

	# Weapon slots
	for i in 5:
		if Input.is_action_just_pressed("slot%d" % (i + 1)):
			s.switch_to(i)
	if Input.is_action_just_pressed("last_weapon"):
		s.switch_to(s.last_slot)
	if Input.is_action_just_pressed("next_weapon"):
		s.cycle_weapon(1)
	if Input.is_action_just_pressed("prev_weapon"):
		s.cycle_weapon(-1)
	if Input.is_action_just_pressed("reload"):
		s.start_reload()

	_update_look_target()
	var fire := Input.is_action_pressed("fire")
	var shove := Input.is_action_just_pressed("shove")

	# Medkit: hold M1 to heal yourself, hold M2 on a teammate to heal them.
	if s.active_slot == Survivor.SLOT_MEDKIT and s.has_medkit:
		if s.action == "":
			if fire:
				s.begin_action("heal_self", 5.0, s)
			elif Input.is_action_pressed("shove") and look_target is Survivor and look_target != s:
				s.begin_action("heal_other", 5.0, look_target)
		elif s.action == "heal_self" and not fire:
			s.cancel_action()
		elif s.action == "heal_other" and not Input.is_action_pressed("shove"):
			s.cancel_action()
	elif s.is_melee_active() and s.active_slot == Survivor.SLOT_SECONDARY:
		# Melee: LMB light/heavy, hold RMB block, LMB while blocking = push.
		s.fire_held = fire
		s.block_held = Input.is_action_pressed("shove")
	else:
		s.fire_held = false
		s.block_held = false
		if fire:
			s.try_fire()
		else:
			s.trigger_released = true
		if shove:
			s.try_shove()

	# Use (E): pickups/doors instantly, revive/radio by holding.
	# Solo testing: no one is coming, so hold E to get yourself back up.
	if s.incapped and not Game.bots_enabled and Input.is_action_just_pressed("use") and s.action == "":
		s.begin_action("self_revive", 5.0, s)
	if s.action == "self_revive" and not Input.is_action_pressed("use"):
		s.cancel_action()
	if Input.is_action_just_pressed("use") and s.action == "":
		if look_target is Survivor and look_target.incapped:
			s.begin_action("revive", 5.0, look_target)
		elif look_target is Usable and look_target.can_use(s):
			if look_target.hold_time > 0.0:
				s.begin_action("use_hold", look_target.hold_time, look_target)
			else:
				look_target.on_use(s)
	if (s.action == "revive" or s.action == "use_hold") and not Input.is_action_pressed("use"):
		s.cancel_action()

	if Input.is_action_just_pressed("ping"):
		_ping()


func _update_look_target() -> void:
	look_target = null
	var eye := s.eye_pos()
	var fwd := s.aim_dir()
	var best := 0.0
	for u in Game.usables:
		if not is_instance_valid(u) or not u.enabled:
			continue
		var p: Vector3 = u.use_point()
		var to := p - eye
		var d := to.length()
		if d > u.use_radius + 0.6:
			continue
		var dot := fwd.dot(to / max(d, 0.01))
		var score := dot - d * 0.05
		if dot > 0.8 and score > best:
			best = score
			look_target = u
	for t in Game.survivors:
		if t == s or not is_instance_valid(t) or t.dead:
			continue
		var to: Vector3 = (t.global_position + Vector3(0, 0.6 if t.incapped else 1.2, 0)) - eye
		var d := to.length()
		if d > 2.4:
			continue
		var dot := fwd.dot(to / d)
		if dot > 0.7 and dot - d * 0.05 + 0.2 > best:
			best = dot - d * 0.05 + 0.2
			look_target = t


func prompt_text() -> String:
	if s.incapped:
		return ""
	if look_target is Survivor:
		if look_target.incapped:
			return "Hold E to help %s up" % look_target.survivor_name
		if s.active_slot == Survivor.SLOT_MEDKIT and s.has_medkit:
			return "Hold RMB to heal %s" % look_target.survivor_name
		return ""
	if look_target is Usable:
		var verb: String = "Hold E" if look_target.hold_time > 0.0 else "E"
		if not look_target.can_use(s):
			if look_target is Pickup:
				return ""
		return "[%s] %s" % [verb, look_target.get_prompt(s)]
	return ""


func _ping() -> void:
	var eye := s.eye_pos()
	var fwd := s.aim_dir()
	var best = null
	var best_dot := 0.97
	for z in Game.infected:
		if not is_instance_valid(z) or z.is_dead() or not z.is_special:
			continue
		var to: Vector3 = z.global_position + Vector3(0, 1, 0) - eye
		var dot := fwd.dot(to.normalized())
		if dot > best_dot and to.length() < 60.0:
			best_dot = dot
			best = z
	if best:
		Game.callout(s, "%s!" % best.kind.capitalize())
		Game.hud.ping_marker(best)
		for b in Game.survivors:
			if b.is_bot and b.controller:
				b.controller.forced_target = best
	else:
		var q := PhysicsRayQueryParameters3D.create(eye, eye + fwd * 60.0, Game.LAYER_WORLD | Game.LAYER_INFECTED)
		var hit := get_world_3d().direct_space_state.intersect_ray(q)
		if not hit.is_empty():
			Game.hud.ping_point(hit["position"])
			Game.callout(s, "Over here!")


# ------------------------------------------------------------------ feedback hooks

func on_weapon_changed() -> void:
	if vm_model:
		vm_model.queue_free()
		vm_model = null
	if melee_root:
		melee_root.queue_free()
		melee_root = null
	for a in arm_parts:
		a.queue_free()
	arm_parts.clear()
	gun_arms.clear()
	var id := s.current_item_id()
	if id != "" and WeaponData.get_def(id).get("melee", false) and WeaponData.DEFS.has(id):
		_build_melee_vm(id)
		Game.sfx.play2d("draw", -10.0)
	else:
		vm_model = WeaponData.build_model(id, true) if id != "" else null
		if vm_model:
			_build_gun_arms()
	if vm_model:
		vm_root.add_child(vm_model)
	vm_reload = 0.0
	land_dip = 0.25


var gun_arms: Array = []   # [fore_r, hand_r, fore_l, hand_l]

func _build_gun_arms() -> void:
	for a in gun_arms:
		if is_instance_valid(a):
			a.queue_free()
	gun_arms.clear()
	var sleeve := Mats.color(s.color.darkened(0.45), 0.9)
	var glove := Mats.color(Color(0.12, 0.1, 0.09), 0.7)
	for i in 4:
		var mi := MeshInstance3D.new()
		mi.mesh = Mats.box(Vector3(1, 1, 1))
		mi.material_override = glove if i % 2 == 1 else sleeve
		mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		camera.add_child(mi)
		gun_arms.append(mi)
		arm_parts.append(mi)


## Hands on the gun: right on the grip, left on the handguard (or both on
## the grip for pistols).
func _update_gun_arms() -> void:
	if gun_arms.size() < 4:
		return
	var id := s.current_item_id()
	var long: bool = WeaponData.DEFS.has(id) and WeaponData.get_def(id).get("slot", 1) == 0
	var xf := vm_root.transform
	var grip_r: Vector3 = xf * Vector3(0, -0.06, 0.02)
	var fore = WeaponData.fore_grip(id)
	var grip_l: Vector3 = xf * (fore if fore != null else (Vector3(0, -0.02, -0.32) if long else Vector3(-0.03, -0.07, 0.01)))
	var el_r := Vector3(0.3, -0.62, 0.15)
	var el_l := Vector3(-0.25, -0.62, 0.05)
	_limb_between(gun_arms[0], grip_r + (el_r - grip_r).normalized() * 0.34, grip_r, 0.06)
	gun_arms[1].transform = Transform3D(xf.basis * Basis.from_scale(Vector3(0.075, 0.09, 0.1)), grip_r)
	_limb_between(gun_arms[2], grip_l + (el_l - grip_l).normalized() * 0.34, grip_l, 0.06)
	gun_arms[3].transform = Transform3D(xf.basis * Basis.from_scale(Vector3(0.075, 0.09, 0.1)), grip_l)
	var show := vm_root.visible and s.action == ""
	if fp_arms:
		fp_arms.visible = show
		if show:
			fp_arms.forward = 0.14 if long else 0.06
			fp_arms.pose(_wrist(grip_r, true), _wrist(grip_l, false))
		for a in gun_arms:
			a.visible = false
		return
	for a in gun_arms:
		a.visible = show


func _build_melee_vm(id: String) -> void:
	melee_root = Node3D.new()
	camera.add_child(melee_root)
	var model := WeaponData.build_model(id, true)
	melee_root.add_child(model)
	var blade := model.get_node_or_null("Blade") as MeshInstance3D
	melee_blade_mat = blade.material_override as StandardMaterial3D if blade else null
	var tip := model.get_node_or_null("Tip") as MeshInstance3D
	if tip and melee_blade_mat:
		tip.material_override = melee_blade_mat
	var sleeve := Mats.color(s.color.darkened(0.45), 0.9)
	var glove := Mats.color(Color(0.12, 0.1, 0.09), 0.7)
	for side in 2:
		for kind in ["upper", "fore", "hand"]:
			var mi := MeshInstance3D.new()
			mi.mesh = Mats.box(Vector3(1, 1, 1))
			mi.material_override = glove if kind == "hand" else sleeve
			mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
			camera.add_child(mi)
			arm_parts.append(mi)
	melee_root.transform = s.melee.idle_pose() if s.melee.ms.size() > 0 else Transform3D()
	trail_mesh = ImmediateMesh.new()
	trail = MeshInstance3D.new()
	trail.mesh = trail_mesh
	var tm := StandardMaterial3D.new()
	tm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	tm.vertex_color_use_as_albedo = true
	tm.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	tm.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
	tm.cull_mode = BaseMaterial3D.CULL_DISABLED
	trail.material_override = tm
	trail.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	camera.add_child(trail)
	arm_parts.append(trail)


## Places a unit box between two camera-space points.
func _limb_between(mi: MeshInstance3D, a: Vector3, b: Vector3, thick: float) -> void:
	var d := b - a
	var l := d.length()
	if l < 0.001:
		return
	var z := d / l
	var x := Vector3.UP.cross(z)
	if x.length_squared() < 0.001:
		x = Vector3.RIGHT
	x = x.normalized()
	var y := z.cross(x)
	mi.transform = Transform3D(Basis(x * thick, y * thick, z * l), (a + b) * 0.5)


## Pull a grip point back toward the shoulder so the wrist sits behind it.
func _wrist(grip: Vector3, right: bool) -> Vector3:
	var sh: Vector3 = fp_arms.shoulder(right) if fp_arms else Vector3(0.21 if right else -0.21, -0.34, 0.12)
	return grip + (sh - grip).normalized() * 0.07


func _update_melee_vm(delta: float, bob: float) -> void:
	var m: Melee = s.melee
	var xf := m.pose
	xf.origin += Vector3(0, bob * 0.5 - land_dip * 0.5, 0)
	melee_root.transform = xf
	if melee_blade_mat:
		melee_blade_mat.albedo_color = Color(0.62, 0.63, 0.66).lerp(Color(0.32, 0.04, 0.03), m.blood * 0.85)
		melee_blade_mat.roughness = lerp(0.25, 0.6, m.blood)
	var grip: float = m.ms.get("grip", 0.3)
	var hand_r: Vector3 = xf * Vector3(0, 0, -grip * 0.25)
	var hand_l: Vector3 = xf * Vector3(0, 0, -grip * 0.8)
	if fp_arms:
		fp_arms.visible = true
		fp_arms.forward = 0.0
		fp_arms.pose(_wrist(hand_r, true), _wrist(hand_l, false))
		for a in arm_parts:
			if a != trail:
				a.visible = false
		return
	# Forearms only: from the hands back toward elbows below the screen.
	var hands := [hand_r, hand_l]
	var elbows := [Vector3(0.32, -0.78, 0.05), Vector3(-0.22, -0.8, 0.05)]
	for side in 2:
		var hand: Vector3 = hands[side]
		var elbow: Vector3 = hand + (elbows[side] - hand).normalized() * 0.36
		arm_parts[side * 3].visible = false
		_limb_between(arm_parts[side * 3 + 1], elbow, hand, 0.06)
		arm_parts[side * 3 + 2].transform = Transform3D(xf.basis.orthonormalized() * Basis.from_scale(Vector3(0.095, 0.1, 0.11)), hand)


func _update_trail(delta: float) -> void:
	var m: Melee = s.melee
	for tp in trail_pts:
		tp[2] += delta
	while trail_pts.size() > 0 and trail_pts[0][2] > 0.09:
		trail_pts.pop_front()
	if m.state == "strike" or (m.state == "follow" and m.t < 0.05):
		var grip: float = m.ms.get("grip", 0.3)
		var length: float = m.ms.get("length", 1.0)
		trail_pts.append([m.pose * Vector3(0, 0, -grip - length * 0.35), m.pose * Vector3(0, 0, -grip - length), 0.0])
	trail_mesh.clear_surfaces()
	if trail_pts.size() < 2:
		return
	trail_mesh.surface_begin(Mesh.PRIMITIVE_TRIANGLE_STRIP)
	for tp in trail_pts:
		var a: float = clamp(1.0 - tp[2] / 0.09, 0.0, 1.0) * (0.35 if not m.is_heavy else 0.5)
		var col := Color(0.9, 0.9, 1.0, 0.0).lerp(Color(1.0, 0.95, 0.9, a), 1.0)
		col.a = a
		trail_mesh.surface_set_color(Color(col.r, col.g, col.b, a * 0.2))
		trail_mesh.surface_add_vertex(tp[0])
		trail_mesh.surface_set_color(col)
		trail_mesh.surface_add_vertex(tp[1])
	trail_mesh.surface_end()


func on_melee_hit(killed: bool, dist: float) -> void:
	hit_shake = max(hit_shake, 0.4 if killed else 0.25)
	if killed and dist < 1.9 and randf() < 0.35:
		Game.hud.screen_blood()


func on_toughness_broken() -> void:
	Game.sfx.play2d("clank", -6.0)
	Game.hud.flash(Color(0.5, 0.7, 1.0, 0.15), 0.25)


func on_perfect_block() -> void:
	hit_shake = max(hit_shake, 0.5)
	Game.hud.flash(Color(1, 0.9, 0.6, 0.18), 0.12)


func on_full_charge() -> void:
	Game.hud.flash(Color(1, 1, 1, 0.08), 0.1)


func on_dodge(dir: Vector3) -> void:
	var right := Vector3(-s.flat_forward().z, 0, s.flat_forward().x)
	dodge_roll = -right.dot(dir) * 0.06


func on_reload(def: Dictionary) -> void:
	vm_reload = def["reload"] if not def.get("shell_reload", false) else 0.0


func on_shove() -> void:
	vm_shove = 0.3


func on_melee() -> void:
	vm_melee = 0.35


func hit_marker(killed: bool, head: bool) -> void:
	Game.hud.hit_marker(killed, head)


func muzzle_point() -> Vector3:
	return camera.global_transform * Vector3(0.22, -0.18, -0.9)


func _process(delta: float) -> void:
	if s == null or not is_instance_valid(s):
		return
	# Camera placement
	var eye_h := Survivor.EYE
	if s.dead:
		eye_h = 0.3
	elif s.incapped or s.pinned_by != null:
		eye_h = 0.5
	elif s.want_crouch:
		eye_h = 1.1
	camera.position.y = lerp(camera.position.y, eye_h, min(1.0, delta * 10.0))
	var speed := Vector2(s.velocity.x, s.velocity.z).length()
	if s.is_on_floor() and speed > 0.5:
		var before := floorf(bob_t / PI)
		bob_t += delta * speed * 1.9
		if floorf(bob_t / PI) != before and not s.want_walk:
			Game.sfx.play2d("step", -16.0 if speed > 3.0 else -22.0)
	if s.is_on_floor() and not _was_on_floor:
		land_dip = 0.12
	_was_on_floor = s.is_on_floor()
	land_dip = max(0.0, land_dip - delta * 0.8)
	var bob: float = sin(bob_t) * 0.03 * clamp(speed / 5.0, 0.0, 1.0)
	var shake: float = Game.fx.shake if Game.fx else 0.0
	var roll := 0.0
	if s.incapped:
		roll = 0.25
	hit_shake = max(0.0, hit_shake - delta * 3.0)
	dodge_roll = lerp(dodge_roll, 0.0, min(1.0, delta * 6.0))
	var punch: Vector2 = s.melee.cam_punch if s.melee else Vector2.ZERO
	var hs := hit_shake * hit_shake * 0.01
	camera.rotation = Vector3(
		s.pitch + randf_range(-1, 1) * (shake * 0.03 + hs) + punch.x,
		s.yaw + randf_range(-1, 1) * (shake * 0.03 + hs) + punch.y,
		roll + dodge_roll)
	camera.position.y += bob - land_dip * 0.3
	flashlight.visible = s.flashlight_enabled and not s.dead
	camera.fov = lerp(camera.fov, Game.fov + (4.0 if speed > 4.5 else 0.0), min(1.0, delta * 4.0))

	# Viewmodel
	vm_kick = max(0.0, vm_kick - delta * 6.0)
	vm_shove = max(0.0, vm_shove - delta)
	vm_melee = max(0.0, vm_melee - delta)
	if vm_reload > 0.0:
		vm_reload = max(0.0, vm_reload - delta)
	var base := Vector3(0.14, -0.14, -0.3)
	var rot := Vector3.ZERO
	base.x += sin(bob_t * 0.5) * 0.01 * clamp(speed / 5.0, 0.0, 1.0)
	base.y += bob * 0.4 - land_dip
	base.z += vm_kick * 0.08
	rot.x += vm_kick * 0.6
	if s.reloading:
		base.y -= 0.12
		rot.x -= 0.6
		rot.z += 0.3
	if s.action != "":
		base.y -= 0.25
	if vm_shove > 0.0:
		var k := sin(vm_shove / 0.3 * PI)
		base += Vector3(-0.12, 0.05, -0.15) * k
		rot.z += 0.6 * k
	if vm_melee > 0.0:
		var k := 1.0 - vm_melee / 0.35
		rot.y = lerp(1.2, -1.0, k)
		rot.x = -0.3
		base.x = lerp(0.4, -0.1, k)
	if s.incapped:
		base.y += 0.05
	vm_root.position = vm_root.position.lerp(base, min(1.0, delta * 20.0))
	vm_root.rotation = vm_root.rotation.lerp(rot, min(1.0, delta * 20.0))
	vm_root.visible = not s.dead and s.pinned_by == null
	if fp_arms and gun_arms.is_empty() and melee_root == null:
		fp_arms.visible = false
	_update_gun_arms()
	if melee_root:
		var show := not s.dead and s.pinned_by == null and not s.incapped and s.action == ""
		melee_root.visible = show
		for a in arm_parts:
			a.visible = show
		if show:
			_update_melee_vm(delta, bob)
			_update_trail(delta)


func _on_fired(def: Dictionary) -> void:
	vm_kick = min(1.0, vm_kick + 0.5)
	var k: float = def.get("kick", 0.01)
	s.pitch = clamp(s.pitch + k, -1.45, 1.45)
	s.yaw += randf_range(-k, k) * 0.3
