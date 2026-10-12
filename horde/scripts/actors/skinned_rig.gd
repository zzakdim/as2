class_name SkinnedRig
extends Rig
## Animated KayKit character (CC0) behind the Rig interface.
##
## Locomotion/idle animations are picked from the pose + speed; attacks and
## hit reactions play as one-shots on top. On death the skeleton is handed to
## Godot's PhysicalBoneSimulator3D for a real ragdoll, and limbs come off by
## hiding their mesh and spawning a rigid gib of it (the KayKit models are
## split into head/arm/leg meshes, which makes this cheap).

const MODELS := {
	"minion": "res://assets/kaykit/skeletons/Skeleton_Minion.glb",
	"warrior": "res://assets/kaykit/skeletons/Skeleton_Warrior.glb",
	"rogue": "res://assets/kaykit/skeletons/Skeleton_Rogue.glb",
	"mage": "res://assets/kaykit/skeletons/Skeleton_Mage.glb",
	"knight": "res://assets/kaykit/adventurers/Knight.glb",
	"barbarian": "res://assets/kaykit/adventurers/Barbarian.glb",
	"rogue_hooded": "res://assets/kaykit/adventurers/Rogue_Hooded.glb",
	"adv_mage": "res://assets/kaykit/adventurers/Mage.glb",
}
const LOOPS := ["Idle", "Idle_B", "Idle_Combat", "Unarmed_Idle", "2H_Melee_Idle", "Walking_A", "Walking_B", "Walking_C",
	"Walking_D_Skeletons", "Walking_Backwards", "Running_A", "Running_B", "Running_C", "Running_Strafe_Left",
	"Running_Strafe_Right", "2H_Ranged_Aiming", "Blocking", "Lie_Idle", "Sit_Floor_Idle", "Sit_Chair_Idle",
	"Spellcasting", "Jump_Idle"]
# Ragdoll bodies: bone -> [capsule radius, length]
const RAG_BONES := {
	"hips": [0.15, 0.17], "spine": [0.15, 0.34], "chest": [0.17, 0.24], "head": [0.22, 0.34],
	"upperarm.l": [0.065, 0.22], "lowerarm.l": [0.055, 0.3], "upperarm.r": [0.065, 0.22], "lowerarm.r": [0.055, 0.3],
	"upperleg.l": [0.085, 0.22], "lowerleg.l": [0.075, 0.2], "upperleg.r": [0.085, 0.22], "lowerleg.r": [0.075, 0.2],
}
const MAX_LIVE_RAGDOLLS := 28

static var _scenes := {}
static var _loops_done := {}
static var _tints := {}
static var ragdolls: Array = []

var kind := ""
var model: Node3D
var skel: Skeleton3D
var anim: AnimationPlayer
var parts := {}              # head, jaw, eyes, arm_l, arm_r, leg_l, leg_r, body, cloak, ... -> MeshInstance3D
var role := "zombie"         # zombie, survivor, boss
var base_anim := ""
var oneshot_t := 0.0
var _acc := 0.0
var _frame := 0
var ragdolled := false
var sim: PhysicalBoneSimulator3D
var _rag_age := 0.0
var _prev_pose := ""
var model_scale := 0.9
var head_scale := 0.62
var melee_held := false


static func create(model_kind: String, opts := {}) -> SkinnedRig:
	var r := SkinnedRig.new()
	r.kind = model_kind
	r.role = opts.get("role", "zombie")
	r.model_scale = opts.get("scale", 1.0) * 0.9
	r.head_scale = opts.get("head_scale", 0.62 if model_kind in ["minion", "warrior", "rogue", "mage"] else 0.7)
	r._build(opts)
	return r


func _build(opts: Dictionary) -> void:
	var path: String = MODELS[kind]
	if not _scenes.has(path):
		_scenes[path] = load(path)
	model = _scenes[path].instantiate()
	add_child(model)
	model.rotation.y = PI          # KayKit faces +Z, our actors face -Z
	model.scale = Vector3.ONE * model_scale
	skel = model.find_child("Skeleton3D", true, false)
	anim = model.find_child("AnimationPlayer", true, false)
	anim.callback_mode_process = AnimationMixer.ANIMATION_CALLBACK_MODE_PROCESS_MANUAL
	if not _loops_done.has(path):
		_loops_done[path] = true
		for n in LOOPS:
			if anim.has_animation(n):
				anim.get_animation(n).loop_mode = Animation.LOOP_LINEAR
	var tint: Color = opts.get("tint", Color(1, 1, 1))
	for c in skel.get_children():
		if c is MeshInstance3D:
			var key := _part_key(c.name)
			parts[key] = c
			if tint != Color(1, 1, 1):
				c.material_override = _tinted(c, tint)
		elif c is BoneAttachment3D:
			# Hide the pack's own swords/shields; keep helmets, capes, hats.
			if c.name.begins_with("handslot"):
				for m in c.get_children():
					m.visible = false
			elif c.bone_name == "head":
				# Hats/helmets ride the head bone but don't inherit its pose
				# scale, so shrink them to match the scaled-down head.
				for m in c.get_children():
					if m is Node3D:
						m.scale *= head_scale
						m.position *= head_scale
						if m is MeshInstance3D:
							parts["helmet"] = m
							if tint != Color(1, 1, 1):
								m.material_override = _tinted(m, tint)
	# KayKit is chibi-proportioned; shrink the head toward adult proportions.
	# A skeleton modifier runs after both animation and ragdoll physics.
	var hs := HeadScaler.new()
	hs.bone = skel.find_bone("head")
	hs.amount = head_scale
	skel.add_child(hs)
	# Weapon attach point in the right hand (barrel along -Z like our models).
	var slot := BoneAttachment3D.new()
	slot.bone_name = "handslot.r"
	skel.add_child(slot)
	held = Node3D.new()
	held.rotation = Vector3(PI / 2, 0, 0)
	slot.add_child(held)
	if opts.get("glow_eyes", Color(0, 0, 0, 0)).a > 0.0 and parts.has("eyes"):
		parts["eyes"].material_override = Mats.emissive(opts["glow_eyes"], 3.0)
	_play(_pick_base(0.0), 0.0, 1.0)
	_acc = randf() * 2.0


static func _part_key(n: String) -> String:
	var low := n.to_lower()
	for pair in [["armleft", "arm_l"], ["armright", "arm_r"], ["legleft", "leg_l"], ["legright", "leg_r"], ["head", "head"],
			["jaw", "jaw"], ["eyes", "eyes"], ["body", "body"], ["cloak", "cloak"], ["cape", "cloak"], ["helmet", "helmet"]]:
		if low.ends_with(pair[0]) or low.find("_" + pair[0]) >= 0:
			return pair[1]
	return low


func _tinted(mi: MeshInstance3D, tint: Color) -> Material:
	var base := mi.get_active_material(0)
	var key := "%s|%s" % [base.get_instance_id(), tint.to_html()]
	if not _tints.has(key):
		var m: StandardMaterial3D = base.duplicate()
		m.albedo_color = m.albedo_color * tint
		_tints[key] = m
	return _tints[key]


# ================================================================ animation

func _play(n: String, blend: float, spd: float) -> void:
	if not anim.has_animation(n):
		return
	anim.play(n, blend, spd)


func _pick_base(speed: float) -> String:
	match pose:
		"sit":
			return "Skeletons_Inactive_Floor_Pose" if role == "zombie" and anim.has_animation("Skeletons_Inactive_Floor_Pose") else "Sit_Floor_Idle"
		"incap":
			return "Lie_Idle"
		"pinned":
			return "Lie_Pose"
		"crouch":
			return "Sit_Floor_Pose" if speed < 0.5 else "Walking_C"
		"dead":
			return "Death_A_Pose"
		"aim":
			if speed > 3.5:
				return "Running_A"
			if speed > 0.4:
				return "Walking_A"
			return "2H_Melee_Idle" if melee_held else "2H_Ranged_Aiming"
		"zombie":
			if speed > 3.2:
				return "Running_C" if role != "boss" else "Running_B"
			if speed > 0.3:
				return "Walking_D_Skeletons" if anim.has_animation("Walking_D_Skeletons") else "Walking_C"
			return "Idle_Combat"
	# idle / wander
	if speed > 0.3:
		return "Walking_D_Skeletons" if anim.has_animation("Walking_D_Skeletons") else "Walking_B"
	return "Skeleton_Inactive_Standing_Pose" if role == "zombie" and anim.has_animation("Skeleton_Inactive_Standing_Pose") else "Idle"


func set_pose(p: String) -> void:
	if p == pose:
		return
	_prev_pose = pose
	pose = p
	if _prev_pose == "sit" and p != "sit" and role == "zombie" and anim.has_animation("Skeletons_Awaken_Floor"):
		_oneshot("Skeletons_Awaken_Floor", 2.2)


func animate(delta: float, speed: float) -> void:
	if ragdolled:
		_rag_age += delta
		return
	if oneshot_t > 0.0:
		oneshot_t -= delta
	else:
		var want := _pick_base(speed)
		var spd := 1.0
		if want.begins_with("Walking"):
			spd = clamp(speed / 1.3, 0.6, 2.2)
		elif want.begins_with("Running"):
			spd = clamp(speed / 5.0, 0.8, 1.6)
		if want != base_anim:
			base_anim = want
			_play(want, 0.2, 1.0)
		anim.speed_scale = spd
	# Animation LOD: far-away characters update less often.
	_acc += delta
	_frame += 1
	var every := 1
	var cam := get_viewport().get_camera_3d() if is_inside_tree() else null
	if cam:
		var d := cam.global_position.distance_squared_to(global_position)
		if d > 1600.0:
			every = 4
		elif d > 400.0:
			every = 2
	if _frame % every == 0:
		anim.advance(_acc)
		_acc = 0.0


func _oneshot(n: String, spd: float) -> void:
	if not anim.has_animation(n):
		return
	anim.speed_scale = 1.0
	anim.play(n, 0.08, spd)
	oneshot_t = anim.get_animation(n).length / spd * 0.92
	base_anim = ""


func swing(dur := 0.4) -> void:
	var n := "1H_Melee_Attack_Chop"
	match role:
		"zombie":
			n = ["1H_Melee_Attack_Chop", "Unarmed_Melee_Attack_Punch_A", "1H_Melee_Attack_Slice_Diagonal"].pick_random()
		"boss":
			n = ["2H_Melee_Attack_Chop", "2H_Melee_Attack_Slice"].pick_random()
		"survivor":
			n = "2H_Melee_Attack_Slice" if melee_held else "Unarmed_Melee_Attack_Punch_B"
	if not anim.has_animation(n):
		return
	var length := anim.get_animation(n).length
	_oneshot(n, clamp(length / max(dur * 2.0, 0.1), 1.0, 2.6))


func flinch(_local_dir: Vector3, force: float) -> void:
	if force < 2.0 or oneshot_t > 0.2:
		return
	_oneshot("Hit_A" if randf() < 0.5 else "Hit_B", 1.6)


func die(_from_dir: Vector3) -> void:
	pose = "dead"
	_oneshot("Death_A" if randf() < 0.5 else "Death_B", 1.0)
	oneshot_t = 999.0


func gib_head() -> void:
	for k in ["head", "jaw", "eyes", "helmet"]:
		if parts.has(k):
			parts[k].visible = false


func gib_arm() -> void:
	var k: String = "arm_l" if randf() < 0.5 else "arm_r"
	if parts.has(k):
		parts[k].visible = false


# ================================================================ ragdoll + gore

func ragdoll(velocity: Vector3, impulse: Vector3, point: Vector3, cut: String) -> bool:
	if ragdolled:
		return true
	ragdolled = true
	# Leave the dying actor: live on in the world as a corpse.
	var xf := global_transform
	var world: Node = Game.world
	get_parent().remove_child(self)
	world.add_child(self)
	global_transform = xf
	anim.pause()
	ragdolls.append(self)
	while ragdolls.size() > MAX_LIVE_RAGDOLLS:
		var old = ragdolls.pop_front()
		if is_instance_valid(old):
			old.queue_free()
	if model_scale > 1.05:
		# Physics bones dislike scaled skeletons: big/small models just play a death.
		anim.play()
		die(impulse)
		_apply_cut(cut, impulse)
		return true
	sim = PhysicalBoneSimulator3D.new()
	skel.add_child(sim)
	skel.move_child(sim, 0)   # physics first, then the head scaler
	var bodies := {}
	for bone in RAG_BONES:
		var bi := skel.find_bone(bone)
		if bi < 0:
			continue
		var spec: Array = RAG_BONES[bone]
		var pb := PhysicalBone3D.new()
		pb.name = "PB_" + bone.replace(".", "_")
		pb.bone_name = bone
		pb.collision_layer = Ragdoll.LAYER_DEBRIS
		pb.collision_mask = Game.LAYER_WORLD
		pb.mass = 3.0 if bone in ["hips", "spine", "chest"] else 1.0
		pb.linear_damp = 0.2
		pb.angular_damp = 2.0
		pb.friction = 0.9
		if bone == "hips":
			pb.joint_type = PhysicalBone3D.JOINT_TYPE_NONE
		else:
			pb.joint_type = PhysicalBone3D.JOINT_TYPE_CONE
			pb.set("joint_constraints/swing_span", 50.0 if bone.begins_with("upperarm") else 35.0)
			pb.set("joint_constraints/twist_span", 20.0)
		var cs := CollisionShape3D.new()
		var cap := CapsuleShape3D.new()
		cap.radius = spec[0]
		cap.height = max(spec[1] + spec[0] * 2.0, spec[0] * 2.05)
		cs.shape = cap
		cs.position = Vector3(0, spec[1] * 0.5, 0)
		pb.add_child(cs)
		sim.add_child(pb)
		bodies[bone] = pb
	if cut == "bisect" and bodies.has("spine"):
		bodies["spine"].joint_type = PhysicalBone3D.JOINT_TYPE_NONE
	if cut == "decap" and bodies.has("head"):
		bodies["head"].joint_type = PhysicalBone3D.JOINT_TYPE_NONE
	sim.physical_bones_start_simulation()
	var nearest = null
	var nd := INF
	for b in bodies:
		var pb: PhysicalBone3D = bodies[b]
		pb.linear_velocity = velocity
		var d := pb.global_position.distance_to(point)
		if d < nd:
			nd = d
			nearest = pb
	if nearest:
		nearest.apply_central_impulse(impulse * 0.45)
	for b in ["chest", "hips"]:
		if bodies.has(b):
			bodies[b].apply_central_impulse(impulse * 0.35)
	_apply_cut(cut, impulse)
	return true


func _apply_cut(cut: String, impulse: Vector3) -> void:
	match cut:
		"decap":
			_gib_part("head", "head", impulse + Vector3(0, 3, 0))
			for k in ["jaw", "eyes", "helmet"]:
				if parts.has(k):
					parts[k].visible = false
			_spurt_at("chest", Vector3(0, 0.26, 0))
		"split":
			var hp := _bone_pos("head")
			for k in ["head", "jaw", "eyes", "helmet"]:
				if parts.has(k):
					parts[k].visible = false
			Game.fx.gib_burst(hp + Vector3(0, 0.15, 0), impulse.normalized(), 0.3)
			_spurt_at("chest", Vector3(0, 0.26, 0))
		"arm":
			var side: String = ["l", "r"].pick_random()
			_gib_part("arm_" + side, "upperarm." + side, impulse * 0.6 + Vector3(0, 2, 0))
			_spurt_at("upperarm." + side, Vector3.ZERO)
		"bisect":
			_gib_part("leg_l", "upperleg.l", impulse * 0.3 + Vector3(-1, 1, 0))
			_gib_part("leg_r", "upperleg.r", impulse * 0.3 + Vector3(1, 1, 0))
			Game.fx.gib_burst(_bone_pos("hips"), impulse.normalized(), 0.2)
			_spurt_at("hips", Vector3.ZERO)
		"gib":
			for pr in [["arm_l", "upperarm.l"], ["arm_r", "upperarm.r"], ["head", "head"], ["leg_l", "upperleg.l"]]:
				if randf() < 0.6:
					_gib_part(pr[0], pr[1], impulse * randf_range(0.3, 0.8) + Vector3(randf_range(-3, 3), 4, randf_range(-3, 3)))


func _bone_pos(bone: String) -> Vector3:
	var bi := skel.find_bone(bone)
	return (skel.global_transform * skel.get_bone_global_pose(bi)).origin


## Hide a limb mesh and throw a rigid copy of it (bind pose, aligned to its bone).
func _gib_part(part: String, bone: String, impulse: Vector3) -> void:
	if not parts.has(part) or not parts[part].visible:
		return
	var mi: MeshInstance3D = parts[part]
	mi.visible = false
	var bi := skel.find_bone(bone)
	if bi < 0:
		return
	var bone_xf := skel.global_transform * skel.get_bone_global_pose(bi)
	var rest := skel.get_bone_global_rest(bi)
	var body := RigidBody3D.new()
	body.collision_layer = Ragdoll.LAYER_DEBRIS
	body.collision_mask = Game.LAYER_WORLD
	body.mass = 1.0
	body.angular_damp = 1.0
	Game.world.add_child(body)
	body.global_transform = Transform3D(bone_xf.basis.orthonormalized(), bone_xf.origin)
	var dup := MeshInstance3D.new()
	dup.mesh = mi.mesh
	dup.material_override = mi.material_override if mi.material_override else mi.get_active_material(0)
	dup.transform = Transform3D(Basis.from_scale(bone_xf.basis.get_scale()), Vector3.ZERO) * rest.affine_inverse()
	body.add_child(dup)
	var cs := CollisionShape3D.new()
	var sh := SphereShape3D.new()
	sh.radius = 0.14
	cs.shape = sh
	body.add_child(cs)
	body.apply_central_impulse(impulse)
	body.angular_velocity = Vector3(randf_range(-12, 12), randf_range(-12, 12), randf_range(-12, 12))
	var spurt: CPUParticles3D = Game.fx.make_spurt()
	body.add_child(spurt)
	spurt.emitting = true
	Effects.after(spurt, 1.2, spurt.set.bind("emitting", false))
	Effects.after(body, 20.0, body.queue_free)


func _spurt_at(bone: String, offset: Vector3) -> void:
	var bi := skel.find_bone(bone)
	if bi < 0:
		return
	var att := BoneAttachment3D.new()
	att.bone_name = bone
	skel.add_child(att)
	var p: CPUParticles3D = Game.fx.make_spurt()
	att.add_child(p)
	p.position = offset
	p.emitting = true
	Effects.after(p, 1.6, p.set.bind("emitting", false))


func _physics_process(delta: float) -> void:
	if not ragdolled:
		return
	if sim == null:
		anim.advance(delta)   # scaled models play their death animation instead
	_rag_age += delta
	if _rag_age > 30.0:
		queue_free()


func _exit_tree() -> void:
	ragdolls.erase(self)


## Keeps the head bone scaled down whatever drives the pose.
class HeadScaler extends SkeletonModifier3D:
	var bone := -1
	var amount := 0.62
	func _process_modification_with_delta(_delta: float) -> void:
		var sk := get_skeleton()
		if sk and bone >= 0:
			sk.set_bone_pose_scale(bone, Vector3.ONE * amount)
