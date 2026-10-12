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
var base_fov := 80.0


func attach(surv: Survivor) -> void:
	s = surv
	s.controller = self
	s.is_bot = false
	s.add_child(self)


func _ready() -> void:
	camera = Camera3D.new()
	camera.fov = base_fov
	camera.near = 0.05
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
	s.rig.visible = false
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

	var playing: bool = Input.mouse_mode == Input.MOUSE_MODE_CAPTURED
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
		s.want_jump = true
	if not playing:
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
	else:
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
	var id := s.current_item_id()
	vm_model = WeaponData.build_model(id, true) if id != "" else null
	if vm_model:
		vm_root.add_child(vm_model)
	vm_reload = 0.0
	land_dip = 0.25


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
		bob_t += delta * speed * 1.9
	if s.is_on_floor() and not _was_on_floor:
		land_dip = 0.12
	_was_on_floor = s.is_on_floor()
	land_dip = max(0.0, land_dip - delta * 0.8)
	var bob: float = sin(bob_t) * 0.03 * clamp(speed / 5.0, 0.0, 1.0)
	var shake: float = Game.fx.shake if Game.fx else 0.0
	var roll := 0.0
	if s.incapped:
		roll = 0.25
	camera.rotation = Vector3(
		s.pitch + randf_range(-1, 1) * shake * 0.03,
		s.yaw + randf_range(-1, 1) * shake * 0.03,
		roll)
	camera.position.y += bob - land_dip * 0.3
	flashlight.visible = s.flashlight_enabled and not s.dead
	camera.fov = lerp(camera.fov, base_fov + (4.0 if speed > 4.5 else 0.0), delta * 4.0)

	# Viewmodel
	vm_kick = max(0.0, vm_kick - delta * 6.0)
	vm_shove = max(0.0, vm_shove - delta)
	vm_melee = max(0.0, vm_melee - delta)
	if vm_reload > 0.0:
		vm_reload = max(0.0, vm_reload - delta)
	var base := Vector3(0.2, -0.19, -0.4)
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


func _on_fired(def: Dictionary) -> void:
	vm_kick = min(1.0, vm_kick + 0.5)
	var k: float = def.get("kick", 0.01)
	s.pitch = clamp(s.pitch + k, -1.45, 1.45)
	s.yaw += randf_range(-k, k) * 0.3
