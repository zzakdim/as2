class_name BodyRig
extends Node3D
## Placeholder humanoid built from boxes with procedural animation.
## Faces -Z. Swap for skinned models later; the actor scripts only call
## animate(), set_pose(), swing() and die().

var hips: Node3D
var torso: Node3D
var head: MeshInstance3D
var arm_l: Node3D
var arm_r: Node3D
var leg_l: Node3D
var leg_r: Node3D
var held: Node3D           # attach point in the right hand
var phase := randf() * TAU
var pose := "idle"          # idle, walk, run, zombie, aim, crouch, sit, incap, pinned, dead
var swing_t := 0.0
var swing_dur := 0.4
var dead_t := -1.0
var dead_dir := 1.0
var cfg := {}
var lean := 0.0
var hunch := 0.0
var leg_len := 0.8
var hip_h := 0.85
var arms_forward := 0.0     # 0 hanging .. 1 straight forward (zombie reach / aiming)


static func make(c: Dictionary) -> BodyRig:
	var r := BodyRig.new()
	r.cfg = c
	r._build()
	return r


func _build() -> void:
	var skin: Color = cfg.get("skin", Color(0.55, 0.6, 0.5))
	var shirt: Color = cfg.get("shirt", Color(0.3, 0.3, 0.35))
	var pants: Color = cfg.get("pants", Color(0.2, 0.2, 0.25))
	var s: float = cfg.get("scale", 1.0)
	var torso_size: Vector3 = cfg.get("torso", Vector3(0.48, 0.62, 0.26)) * s
	var head_size: float = cfg.get("head", 0.26) * s
	var arm_len: float = cfg.get("arm_len", 0.68) * s
	var arm_w: float = cfg.get("arm_w", 0.13) * s
	var arm_r_mult: float = cfg.get("arm_r_mult", 1.0)
	leg_len = cfg.get("leg_len", 0.82) * s
	var leg_w: float = cfg.get("leg_w", 0.17) * s
	hunch = cfg.get("hunch", 0.0)
	hip_h = leg_len + 0.03
	var m_skin := Mats.color(skin)
	var m_shirt := Mats.color(shirt)
	var m_pants := Mats.color(pants)

	hips = Node3D.new()
	hips.position.y = hip_h
	add_child(hips)
	torso = Node3D.new()
	hips.add_child(torso)
	Mats.add_mesh(torso, Mats.box(torso_size), m_shirt, Vector3(0, torso_size.y * 0.5, 0))
	if cfg.has("belly"):
		var b: float = cfg["belly"] * s
		Mats.add_mesh(torso, Mats.sphere(b, 12), Mats.color(cfg.get("belly_color", skin)), Vector3(0, torso_size.y * 0.4, -b * 0.35))
	head = Mats.add_mesh(torso, Mats.box(Vector3(head_size, head_size * 1.1, head_size)), m_skin, Vector3(0, torso_size.y + head_size * 0.6, 0))
	if cfg.has("eyes"):
		var em := Mats.emissive(cfg["eyes"], 4.0)
		Mats.add_mesh(head, Mats.box(Vector3(head_size * 0.2, head_size * 0.08, 0.02)), em, Vector3(-head_size * 0.22, head_size * 0.1, -head_size * 0.51))
		Mats.add_mesh(head, Mats.box(Vector3(head_size * 0.2, head_size * 0.08, 0.02)), em, Vector3(head_size * 0.22, head_size * 0.1, -head_size * 0.51))
	if cfg.has("hood"):
		Mats.add_mesh(head, Mats.box(Vector3(head_size * 1.15, head_size * 1.2, head_size * 1.15)), m_shirt, Vector3(0, 0.02, 0.02))

	var sh_y := torso_size.y * 0.92
	var sh_x := torso_size.x * 0.5 + arm_w * 0.5
	arm_l = _limb(torso, Vector3(-sh_x, sh_y, 0), arm_len, arm_w, m_skin if cfg.get("bare_arms", true) else m_shirt)
	arm_r = _limb(torso, Vector3(sh_x * (1.0 + (arm_r_mult - 1.0) * 0.4), sh_y, 0), arm_len * (1.0 + (arm_r_mult - 1.0) * 0.3), arm_w * arm_r_mult, m_skin if cfg.get("bare_arms", true) else m_shirt)
	held = Node3D.new()
	held.position = Vector3(0, -arm_len * 0.95, 0)
	held.rotation.x = -PI / 2
	arm_r.add_child(held)
	leg_l = _limb(hips, Vector3(-leg_w * 0.6, 0, 0), leg_len, leg_w, m_pants)
	leg_r = _limb(hips, Vector3(leg_w * 0.6, 0, 0), leg_len, leg_w, m_pants)


func _limb(parent: Node3D, pivot: Vector3, length: float, width: float, mat: Material) -> Node3D:
	var p := Node3D.new()
	p.position = pivot
	parent.add_child(p)
	Mats.add_mesh(p, Mats.box(Vector3(width, length, width)), mat, Vector3(0, -length * 0.5, 0))
	return p


func set_pose(p: String) -> void:
	pose = p


func swing(dur := 0.4) -> void:
	swing_t = dur
	swing_dur = dur


func gib_head() -> void:
	if head:
		head.visible = false


func gib_arm() -> void:
	(arm_l if randf() < 0.5 else arm_r).visible = false


func die(from_dir: Vector3) -> void:
	pose = "dead"
	dead_t = 0.0
	# fall away from the shot
	var fwd := -global_transform.basis.z
	dead_dir = 1.0 if fwd.dot(from_dir) > 0 else -1.0


## speed: horizontal m/s. Call every frame.
func animate(delta: float, speed: float) -> void:
	if pose == "dead":
		if dead_t >= 0.0 and dead_t < 1.0:
			dead_t += delta * 2.2
			var k: float = min(dead_t, 1.0)
			rotation.x = -dead_dir * k * PI * 0.47
			position.y = -k * 0.05
			arm_l.rotation.x = lerp(arm_l.rotation.x, 2.6, k)
			arm_r.rotation.x = lerp(arm_r.rotation.x, 2.2, k)
		return
	phase += delta * (2.0 + speed * 1.7)
	var stride: float = clamp(speed / 5.0, 0.0, 1.0)
	var sw := sin(phase)
	var body_bob: float = abs(cos(phase)) * 0.05 * stride
	var lean_target := hunch
	var hips_y := hip_h + body_bob
	var arm_base := 0.0
	var legs_amp := 0.75 * stride
	match pose:
		"zombie":
			arms_forward = lerp(arms_forward, 1.0 if speed > 2.0 else 0.25, delta * 4.0)
			lean_target += 0.25 * stride
		"aim":
			arms_forward = 1.0
		"crouch":
			hips_y = hip_h * 0.62
			legs_amp *= 0.4
			lean_target += 0.35
			arms_forward = lerp(arms_forward, 0.6, delta * 6.0)
		"sit":
			hips_y = 0.25
			legs_amp = 0.0
			arms_forward = 0.3
		"incap", "pinned":
			hips_y = 0.2
			legs_amp = 0.0
			lean_target = -1.2 if pose == "incap" else -1.45
			arms_forward = 0.8 if pose == "incap" else 0.2
		_:
			arms_forward = lerp(arms_forward, 0.0, delta * 4.0)
	hips.position.y = lerp(hips.position.y, hips_y, min(1.0, delta * 10.0))
	lean = lerp(lean, lean_target, min(1.0, delta * 6.0))
	torso.rotation.x = -lean
	if pose == "sit":
		leg_l.rotation.x = 1.5
		leg_r.rotation.x = 1.5
	elif pose == "incap" or pose == "pinned":
		leg_l.rotation.x = 1.3 + sw * 0.05
		leg_r.rotation.x = 1.4
	elif pose == "crouch":
		leg_l.rotation.x = 0.9 + sw * legs_amp
		leg_r.rotation.x = 0.9 - sw * legs_amp
	else:
		leg_l.rotation.x = sw * legs_amp
		leg_r.rotation.x = -sw * legs_amp
	arm_base = arms_forward * 1.5
	var arm_sw: float = sw * 0.6 * stride * (1.0 - arms_forward * 0.7)
	arm_l.rotation.x = arm_base - arm_sw + (sin(phase * 0.5) * 0.1 if pose == "zombie" else 0.0)
	arm_r.rotation.x = arm_base + arm_sw
	if pose == "aim":
		arm_l.rotation = Vector3(1.45, 0.0, -0.45)
		arm_r.rotation = Vector3(1.5, 0.0, 0.1)
	else:
		arm_l.rotation.z = 0.0
		arm_r.rotation.z = 0.0
	if swing_t > 0.0:
		swing_t -= delta
		var k := 1.0 - swing_t / swing_dur
		var a := sin(k * PI)
		arm_r.rotation.x = lerp(2.6, 0.4, k)
		arm_r.rotation.z = 0.4 * a
		if pose == "zombie":
			arm_l.rotation.x = lerp(2.4, 0.6, clamp(k * 1.2 - 0.2, 0.0, 1.0))
