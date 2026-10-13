class_name SkinnedRig
extends Rig
## Animated character behind the Rig interface. Two art families:
##   human  - Quaternius Universal Base Characters (realistic proportions)
##            driven by the Universal Animation Library 1+2 (incl. zombie set)
##   kaykit - stylized KayKit skeletons/adventurers
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
const HUMAN_MODELS := {
	"human_m": "res://assets/quaternius/humans/Superhero_Male_FullBody.gltf",
	"human_f": "res://assets/quaternius/humans/Superhero_Female_FullBody.gltf",
}
const HUMAN_LIBS := ["res://assets/quaternius/anims/UAL1_Standard.glb", "res://assets/quaternius/anims/UAL2_Standard.glb"]
# KayKit animation name -> Universal Animation Library name ("@end" = hold last frame)
const HUMAN_ANIM := {
	"Skeletons_Inactive_Floor_Pose": "Crouch_Idle", "Sit_Floor_Idle": "Crouch_Idle", "Sit_Floor_Pose": "Crouch_Idle",
	"Lie_Idle": "Death01@end", "Lie_Pose": "Death01@end", "Death_A_Pose": "Death01@end",
	"Walking_D_Skeletons": "Zombie_Walk_Fwd", "Walking_B": "Zombie_Walk_Fwd", "Walking_C": "Crouch_Fwd", "Walking_A": "Walk",
	"Running_C": "Sprint", "Running_B": "Sprint", "Running_A": "Jog_Fwd",
	"Idle_Combat": "Zombie_Idle", "Skeleton_Inactive_Standing_Pose": "Zombie_Idle", "Idle": "Idle",
	"2H_Melee_Idle": "Sword_Idle", "2H_Ranged_Aiming": "Pistol_Idle",
	"1H_Melee_Attack_Chop": "Zombie_Scratch", "1H_Melee_Attack_Slice_Diagonal": "Zombie_Scratch",
	"Unarmed_Melee_Attack_Punch_A": "Punch_Jab", "Unarmed_Melee_Attack_Punch_B": "Melee_Hook",
	"2H_Melee_Attack_Chop": "Punch_Cross", "2H_Melee_Attack_Slice": "Sword_Regular_A",
	"Hit_A": "Hit_Chest", "Hit_B": "Hit_Head", "Death_A": "Death01", "Death_B": "Death01",
}
const HUMAN_RAG_BONES := {
	"pelvis": [0.14, 0.12], "spine_01": [0.14, 0.22], "spine_03": [0.16, 0.24], "Head": [0.11, 0.22],
	"upperarm_l": [0.055, 0.25], "lowerarm_l": [0.045, 0.24], "upperarm_r": [0.055, 0.25], "lowerarm_r": [0.045, 0.24],
	"thigh_l": [0.075, 0.4], "calf_l": [0.06, 0.42], "thigh_r": [0.075, 0.4], "calf_r": [0.06, 0.42],
}
# Generic bone role -> per-family bone name
const HUMAN_BONES := {"head": "Head", "chest": "spine_03", "hips": "pelvis", "spine": "spine_01",
	"upperarm.l": "upperarm_l", "upperarm.r": "upperarm_r", "upperleg.l": "thigh_l", "upperleg.r": "thigh_r",
	"handslot.r": "hand_r", "handslot.l": "hand_l"}
const KAYKIT_ZOMBIES := ["minion", "warrior", "rogue", "mage"]

static var style := "human"        # "human" (realistic) or "kaykit" (stylized)
static var _human_lib: AnimationLibrary

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
var family := "kaykit"


static func create(model_kind: String, opts := {}) -> Rig:
	if Infected.use_box_rigs:
		# Fast placeholder figure, roughly matching size and colour.
		var t: Color = opts.get("tint", Color(0.8, 0.8, 0.8))
		var sc: float = opts.get("scale", 1.0)
		return BodyRig.make({"skin": Color(0.6, 0.62, 0.52) * t, "shirt": Color(0.4, 0.38, 0.35) * t,
			"pants": Color(0.25, 0.25, 0.28), "scale": sc, "hunch": 0.15 if opts.get("role", "zombie") == "zombie" else 0.0,
			"bare_arms": opts.get("role", "zombie") != "survivor"})
	var r := SkinnedRig.new()
	r.role = opts.get("role", "zombie")
	if style == "human":
		r.family = "human"
		r.kind = _human_kind(model_kind, opts)
		r.model_scale = opts.get("scale", 1.0) * randf_range(0.95, 1.04) if r.role == "zombie" else opts.get("scale", 1.0)
		r.head_scale = 1.0
	else:
		r.kind = model_kind
		r.model_scale = opts.get("scale", 1.0) * 0.9
		r.head_scale = opts.get("head_scale", 0.55 if model_kind in KAYKIT_ZOMBIES else 0.68)
	r._build(opts)
	return r


static func _human_kind(k: String, opts: Dictionary) -> String:
	if opts.has("human"):
		return opts["human"]
	match k:
		"rogue_hooded", "rogue":
			return "human_f"
		"knight", "barbarian", "adv_mage", "warrior":
			return "human_m"
	return "human_m" if randf() < 0.6 else "human_f"


## One shared AnimationLibrary built from the Universal Animation Library glbs.
static func human_library() -> AnimationLibrary:
	if _human_lib:
		return _human_lib
	_human_lib = AnimationLibrary.new()
	for path in HUMAN_LIBS:
		var sc: Node = load(path).instantiate()
		var ap: AnimationPlayer = sc.find_child("AnimationPlayer", true, false)
		for n in ap.get_animation_list():
			if not _human_lib.has_animation(n):
				_human_lib.add_animation(n, ap.get_animation(n))
		sc.free()
	return _human_lib


## Bone name for a generic role in this rig's family.
func b(role_name: String) -> String:
	return HUMAN_BONES.get(role_name, role_name) if family == "human" else role_name


func _build(opts: Dictionary) -> void:
	var path: String = HUMAN_MODELS[kind] if family == "human" else MODELS[kind]
	if not _scenes.has(path):
		_scenes[path] = load(path)
	model = _scenes[path].instantiate()
	add_child(model)
	model.rotation.y = PI          # models face +Z, our actors face -Z
	model.scale = Vector3.ONE * model_scale
	skel = model.find_child("Skeleton3D", true, false)
	if family == "human":
		anim = AnimationPlayer.new()
		model.add_child(anim)
		anim.add_animation_library("", human_library())
	else:
		anim = model.find_child("AnimationPlayer", true, false)
	anim.callback_mode_process = AnimationMixer.ANIMATION_CALLBACK_MODE_PROCESS_MANUAL
	if not _loops_done.has(path):
		_loops_done[path] = true
		for n in LOOPS:
			if anim.has_animation(n):
				anim.get_animation(n).loop_mode = Animation.LOOP_LINEAR
	var tint: Color = opts.get("tint", Color(1, 1, 1))
	var outfit := _outfit(opts, tint) if family == "human" else {}
	for c in skel.get_children():
		if c is MeshInstance3D:
			var key := _part_key(c.name)
			parts[key] = c
			if outfit.has(key):
				c.material_override = outfit[key]
			elif tint != Color(1, 1, 1):
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
	if head_scale < 0.99:
		var hs := HeadScaler.new()
		hs.bone = skel.find_bone("head")
		hs.amount = head_scale
		skel.add_child(hs)
	# Weapon attach point in the right hand (barrel along -Z like our models).
	var slot := BoneAttachment3D.new()
	slot.bone_name = b("handslot.r")
	skel.add_child(slot)
	held = Node3D.new()
	held.rotation = Vector3(PI / 2, 0, 0)
	slot.add_child(held)
	if family == "human":
		var hair: Array = opts.get("hair", _random_hair())
		for h in hair:
			_add_hair(h, opts.get("hair_color", HAIR_COLORS.pick_random() * (0.8 if role == "zombie" else 1.0)))
	if opts.get("glow_eyes", Color(0, 0, 0, 0)).a > 0.0 and parts.has("eyes"):
		parts["eyes"].material_override = Mats.emissive(opts["glow_eyes"], 3.0)
	_play(_pick_base(0.0), 0.0, 1.0)
	_acc = randf() * 2.0


# The hair textures are greyscale (the paid version tints them in a shader).
const HAIR_COLORS := [Color(0.22, 0.15, 0.1), Color(0.12, 0.09, 0.07), Color(0.38, 0.26, 0.15), Color(0.55, 0.42, 0.25),
	Color(0.32, 0.18, 0.1), Color(0.45, 0.43, 0.4)]

func _random_hair() -> Array:
	if role != "zombie":
		return []
	if kind == "human_f":
		return [["Hair_Long", "Hair_Buns", "Hair_Long"].pick_random()]
	return [[], ["Hair_Buzzed"], ["Hair_SimpleParted"], ["Hair_Buzzed", "Hair_Beard"]].pick_random()


## Hairstyles ship in model space ("origin at 0"), so they hang off the head
## bone with the inverse of its rest pose.
func _add_hair(hname: String, tint: Color) -> void:
	var path := "res://assets/quaternius/hair/%s.gltf" % hname
	if not ResourceLoader.exists(path):
		return
	if not _scenes.has(path):
		_scenes[path] = load(path)
	var bi := skel.find_bone("Head")
	if bi < 0:
		return
	var att := BoneAttachment3D.new()
	att.bone_name = "Head"
	skel.add_child(att)
	var h: Node3D = _scenes[path].instantiate()
	att.add_child(h)
	h.transform = skel.get_bone_global_rest(bi).affine_inverse()
	for m in h.find_children("*", "MeshInstance3D", true, false):
		parts["hair_%d" % parts.size()] = m
		if tint != Color(1, 1, 1):
			m.material_override = _tinted(m, tint)


## Hang a static prop (shield, blade) on a hand slot.
func attach_prop(path: String, bone: String) -> void:
	if not _scenes.has(path):
		_scenes[path] = load(path)
	var att := BoneAttachment3D.new()
	att.bone_name = b(bone)
	skel.add_child(att)
	var prop: Node3D = _scenes[path].instantiate()
	att.add_child(prop)
	if family == "human":
		prop.scale = Vector3.ONE * 0.62   # KayKit props are sized for chibi hands
	prop.rotation.y = PI if bone.ends_with(".r") else 0.0


## Clothing for the realistic bodies: the free base meshes are bare, so the
## split parts get fabric materials (shirt on torso+arms, so hands read as
## gloves; trousers on legs, so feet read as boots). The head keeps its
## textured skin, tinted for the infected.
const CLOTH_TOPS := [Color(0.22, 0.24, 0.2), Color(0.3, 0.22, 0.16), Color(0.18, 0.2, 0.26), Color(0.35, 0.33, 0.3),
	Color(0.4, 0.12, 0.1), Color(0.14, 0.14, 0.15), Color(0.42, 0.4, 0.34)]
const CLOTH_BOTTOMS := [Color(0.16, 0.18, 0.24), Color(0.22, 0.2, 0.16), Color(0.12, 0.12, 0.12), Color(0.28, 0.26, 0.22)]

func _outfit(opts: Dictionary, tint: Color) -> Dictionary:
	var top: Color = opts.get("top", CLOTH_TOPS.pick_random() * (0.8 if role == "zombie" else 1.0))
	var bottom: Color = opts.get("bottom", CLOTH_BOTTOMS.pick_random())
	if role != "survivor" and tint != Color(1, 1, 1):
		top = top * tint
		bottom = bottom * tint
	var normal_tex: Texture2D = null
	var body: MeshInstance3D = skel.find_child("Human_Body", false, false)
	if body:
		var base := body.get_active_material(0)
		if base is BaseMaterial3D:
			normal_tex = base.normal_texture
	var out := {}
	var grime := role != "survivor"
	var top_m := _cloth(top, normal_tex, randi() % 3 if grime else -1)
	var bottom_m := _cloth(bottom, normal_tex, randi() % 3 if grime else -1)
	out["body"] = top_m
	out["arm_l"] = top_m
	out["arm_r"] = top_m
	out["leg_l"] = bottom_m
	out["leg_r"] = bottom_m
	var head: MeshInstance3D = skel.find_child("Human_Head", false, false)
	if head:
		var skin: Color = opts.get("skin", Color(0.62, 0.7, 0.55) if role != "survivor" else Color(1, 1, 1))
		if role != "survivor":
			skin = skin * tint
		if skin != Color(1, 1, 1):
			out["head"] = _tinted(head, skin)
	return out


## Fabric material; `stain` >= 0 picks one of a few procedural grime/blood maps.
func _cloth(c: Color, normal_tex: Texture2D, stain := -1) -> StandardMaterial3D:
	var key := "cloth|%s|%s|%d" % [c.to_html(), normal_tex != null, stain]
	if not _tints.has(key):
		var m := StandardMaterial3D.new()
		m.albedo_color = c
		if stain >= 0:
			m.albedo_texture = _stain_tex(stain)
		m.roughness = 0.92
		if normal_tex:
			m.normal_enabled = true
			m.normal_texture = normal_tex
			m.normal_scale = 0.6
		_tints[key] = m
	return _tints[key]


static var _stains := {}

## White cloth with dirt mottling and dark blood splotches (multiplied by the
## cloth colour), generated once per variant.
static func _stain_tex(v: int) -> Texture2D:
	if _stains.has(v):
		return _stains[v]
	var n := FastNoiseLite.new()
	n.seed = 100 + v * 17
	n.frequency = 0.012
	n.fractal_octaves = 4
	var n2 := FastNoiseLite.new()
	n2.seed = 300 + v * 31
	n2.frequency = 0.03
	var size := 256
	var img := Image.create(size, size, false, Image.FORMAT_RGB8)
	for y in size:
		for x in size:
			var dirt := 0.75 + 0.25 * n2.get_noise_2d(x, y)
			var b := n.get_noise_2d(x, y)
			var col := Color(dirt, dirt * 0.97, dirt * 0.92)
			if b > 0.28:
				var k: float = clamp((b - 0.28) * 6.0, 0.0, 1.0)
				col = col.lerp(Color(0.38, 0.05, 0.04), k)
			img.set_pixel(x, y, col)
	var t := ImageTexture.create_from_image(img)
	_stains[v] = t
	return t


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

## Translate a (KayKit-named) animation for this rig's family.
func _an(n: String) -> String:
	if family != "human":
		return n
	return HUMAN_ANIM.get(n, n)


var _hold := false

func _play(n: String, blend: float, spd: float) -> void:
	n = _an(n)
	_hold = n.ends_with("@end")
	if _hold:
		n = n.trim_suffix("@end")
	if not anim.has_animation(n):
		return
	anim.play(n, blend, spd)
	if _hold:
		anim.seek(anim.get_animation(n).length - 0.02, true)


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
		anim.speed_scale = 0.0 if _hold else spd
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
	n = _an(n)
	_hold = false
	if n.ends_with("@end") or not anim.has_animation(n):
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
	if not anim.has_animation(_an(n)):
		return
	var length := anim.get_animation(_an(n)).length
	_oneshot(n, clamp(length / max(dur * 2.0, 0.1), 1.0, 2.6))


func flinch(_local_dir: Vector3, force: float) -> void:
	if force < 2.0 or oneshot_t > 0.2:
		return
	_oneshot("Hit_A" if randf() < 0.5 else "Hit_B", 1.6)


func die(_from_dir: Vector3) -> void:
	pose = "dead"
	_oneshot("Death_A" if randf() < 0.5 else "Death_B", 1.0)
	oneshot_t = 999.0


func _hide_head_parts() -> void:
	for k in parts:
		if k in ["head", "jaw", "eyes", "eyebrows", "helmet"] or k.begins_with("hair_"):
			parts[k].visible = false


func gib_head() -> void:
	_hide_head_parts()


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
	var rag: Dictionary = HUMAN_RAG_BONES if family == "human" else RAG_BONES
	for bone in rag:
		var bi := skel.find_bone(bone)
		if bi < 0:
			continue
		var spec: Array = rag[bone]
		var pb := PhysicalBone3D.new()
		pb.name = "PB_" + bone.replace(".", "_")
		pb.bone_name = bone
		pb.collision_layer = Ragdoll.LAYER_DEBRIS
		pb.collision_mask = Game.LAYER_WORLD
		pb.mass = 3.0 if bone in ["hips", "spine", "chest", "pelvis", "spine_01", "spine_03"] else 1.0
		pb.linear_damp = 0.2
		pb.angular_damp = 2.0
		pb.friction = 0.9
		if bone == b("hips"):
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
	if cut == "bisect" and bodies.has(b("spine")):
		bodies[b("spine")].joint_type = PhysicalBone3D.JOINT_TYPE_NONE
	if cut == "decap" and bodies.has(b("head")):
		bodies[b("head")].joint_type = PhysicalBone3D.JOINT_TYPE_NONE
	sim.physical_bones_start_simulation()
	var nearest = null
	var nd := INF
	for bn in bodies:
		var pb: PhysicalBone3D = bodies[bn]
		pb.linear_velocity = velocity
		var d := pb.global_position.distance_to(point)
		if d < nd:
			nd = d
			nearest = pb
	if nearest:
		nearest.apply_central_impulse(impulse * 0.45)
	for bn in [b("chest"), b("hips")]:
		if bodies.has(bn):
			bodies[bn].apply_central_impulse(impulse * 0.35)
	_apply_cut(cut, impulse)
	return true


func _apply_cut(cut: String, impulse: Vector3) -> void:
	match cut:
		"decap":
			_gib_part("head", "head", impulse + Vector3(0, 3, 0))
			_hide_head_parts()
			_spurt_at("chest", Vector3(0, 0.26, 0))
		"split":
			var hp := _bone_pos("head")
			_hide_head_parts()
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
	var bi := skel.find_bone(b(bone))
	return (skel.global_transform * skel.get_bone_global_pose(bi)).origin


## Hide a limb mesh and throw a rigid copy of it (bind pose, aligned to its bone).
func _gib_part(part: String, bone: String, impulse: Vector3) -> void:
	if not parts.has(part) or not parts[part].visible:
		return
	var mi: MeshInstance3D = parts[part]
	mi.visible = false
	var bi := skel.find_bone(b(bone))
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
	var bi := skel.find_bone(b(bone))
	if bi < 0:
		return
	var att := BoneAttachment3D.new()
	att.bone_name = b(bone)
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
