class_name FPArms
extends Node3D
## First-person arms: the realistic body's own arm meshes, hung under the
## camera and posed every frame with an analytic two-bone IK so the hands
## grip whatever the viewmodel is holding (sword handle, rifle, pistol).

const MODEL := "res://assets/quaternius/humans/Outfit_Male_Ranger.gltf"
const MODEL_BARE := "res://assets/quaternius/humans/Superhero_Male_FullBody.gltf"

var model: Node3D
var skel: Skeleton3D
var bones := {}       # "upperarm_l" -> index ...
var lens := {}        # side -> [upper length, lower length]
var sleeve: Material
var active := true
var _skin_mats := []      # [material, clean colour]
var _cloth_mats := []
var _blood := -1.0
var base_pos := Vector3.ZERO
var forward := 0.0     # shoulders pushed forward (m): more reach for long guns


static func available() -> bool:
	return ResourceLoader.exists(MODEL) or ResourceLoader.exists(MODEL_BARE)


func setup(shirt: Color) -> void:
	var dressed := ResourceLoader.exists(MODEL)
	model = load(MODEL if dressed else MODEL_BARE).instantiate()
	add_child(model)
	model.rotation.y = PI
	model.scale = Vector3.ONE * 1.15   # viewmodel arms are cheated a bit longer
	skel = model.find_child("Skeleton3D", true, false)
	sleeve = Mats.color(shirt, 0.92)
	var glove := Mats.color(Color(0.06, 0.055, 0.05), 0.85)
	for c in skel.get_children():
		if c is MeshInstance3D:
			var keep: bool = c.name in ["Human_ArmLeft", "Human_ArmRight", "Human_HandLeft", "Human_HandRight"]
			c.visible = keep
			c.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
			if keep:
				if dressed:
					# Real sleeves and bracers, tinted toward the survivor's colour.
					for i in c.mesh.get_surface_count():
						var base: Material = c.mesh.surface_get_material(i)
						if base == null:
							continue
						var m: StandardMaterial3D = base.duplicate()
						var skin: bool = base.resource_name.contains("Regular") or base.resource_name.contains("Superhero")
						if String(c.name).contains("Hand"):
							# Worn leather gloves over the whole hand: a closed
							# glove reads as a grip from any angle.
							m = _glove_mat()
							_skin_mats.append([m, m.albedo_color])
						elif not skin:
							m.albedo_color = Color(1, 1, 1).lerp(shirt.lightened(0.35), 0.55)
							_cloth_mats.append([m, m.albedo_color])
						else:
							_skin_mats.append([m, m.albedo_color])
						c.set_surface_override_material(i, m)
				else:
					c.material_override = glove if String(c.name).contains("Hand") else sleeve
				# Culling uses the T-pose bounds (beside the camera); the IK
				# moves the arms in front of it, so don't let them get culled.
				c.extra_cull_margin = 4.0
	for side in ["l", "r"]:
		for b in ["clavicle", "upperarm", "lowerarm", "hand"]:
			bones["%s_%s" % [b, side]] = skel.find_bone("%s_%s" % [b, side])
		var s0 := skel.get_bone_global_rest(bones["upperarm_" + side]).origin
		var e0 := skel.get_bone_global_rest(bones["lowerarm_" + side]).origin
		var h0 := skel.get_bone_global_rest(bones["hand_" + side]).origin
		lens[side] = [s0.distance_to(e0), e0.distance_to(h0)]
	# Put the shoulders just below and behind the eye: rotated PI, the left
	# shoulder (x=+0.21, y=1.456) lands at x=-0.21 on screen.
	var sh := skel.get_bone_global_rest(bones["upperarm_l"]).origin
	model.position = Vector3(0, -0.34 - sh.y * 1.15, 0.12 + sh.z * 1.15)
	base_pos = model.position


static func _glove_mat() -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.albedo_color = Color(0.2, 0.135, 0.09)
	m.roughness = 0.62
	m.metallic_specular = 0.35
	# Creased, worn leather.
	var n := FastNoiseLite.new()
	n.frequency = 0.09
	n.fractal_octaves = 4
	var tex := NoiseTexture2D.new()
	tex.noise = n
	tex.width = 256
	tex.height = 256
	tex.as_normal_map = true
	tex.bump_strength = 4.0
	tex.seamless = true
	m.normal_enabled = true
	m.normal_texture = tex
	m.normal_scale = 0.6
	m.uv1_triplanar = true
	m.uv1_scale = Vector3.ONE * 6.0
	return m


## Gore on the hands and sleeves (0..1), following the blade's.
func set_blood(k: float) -> void:
	if absf(k - _blood) < 0.02:
		return
	_blood = k
	for e in _skin_mats:
		(e[0] as StandardMaterial3D).albedo_color = (e[1] as Color).lerp(Color(0.5, 0.08, 0.06), k * 0.55)
		(e[0] as StandardMaterial3D).roughness = lerpf(0.6, 0.3, k)
	for e in _cloth_mats:
		(e[0] as StandardMaterial3D).albedo_color = (e[1] as Color).lerp(Color(0.25, 0.04, 0.03), k * 0.35)


## Shoulder position in camera space (for the wrist pull-back).
func shoulder(right: bool) -> Vector3:
	return Vector3(0.21 if right else -0.21, -0.34, 0.12 - forward)


## Pose both arms. Targets are wrist positions in camera space; pass
## Vector3.INF for an arm that should hang out of view.
## `frame_r` / `frame_l`: optional [finger direction, palm direction] in
## camera space to orient the hand (e.g. wrapped round a pistol grip);
## empty keeps the hand in line with the forearm.
func pose(wrist_r: Vector3, wrist_l: Vector3, frame_r := [], frame_l := []) -> void:
	if skel == null:
		return
	model.position = base_pos - Vector3(0, 0, forward)
	skel.reset_bone_poses()
	_solve("r", wrist_r, Vector3(0.6, -1.0, 0.4), frame_r)
	_solve("l", wrist_l, Vector3(-0.6, -1.0, 0.4), frame_l)
	_curl("r")
	_curl("l")


var _rest_frames := {}

## The hand's rest frame in skeleton space: [finger dir, palm-facing dir].
func _rest_frame(side: String) -> Array:
	if _rest_frames.has(side):
		return _rest_frames[side]
	var h := skel.get_bone_global_rest(bones["hand_" + side]).origin
	var mid := skel.get_bone_global_rest(skel.find_bone("middle_01_" + side)).origin
	var idx := skel.get_bone_global_rest(skel.find_bone("index_01_" + side)).origin
	var pky := skel.get_bone_global_rest(skel.find_bone("pinky_01_" + side)).origin
	var f := (mid - h).normalized()
	var across := (idx - pky).normalized()
	var palm := f.cross(across).normalized() if side == "l" else across.cross(f).normalized()
	_rest_frames[side] = [f, palm]
	return _rest_frames[side]


func _solve(side: String, target_cam: Vector3, pole_dir_cam: Vector3, frame := []) -> void:
	var ua: int = bones["upperarm_" + side]
	var la: int = bones["lowerarm_" + side]
	var hd: int = bones["hand_" + side]
	var cl: int = bones["clavicle_" + side]
	var to_skel: Transform3D = skel.global_transform.affine_inverse() * (get_parent() as Node3D).global_transform
	if target_cam == Vector3.INF:
		target_cam = Vector3(0.25 if side == "r" else -0.25, -0.9, 0.2)  # tucked away
	var T: Vector3 = to_skel * target_cam
	var pole: Vector3 = (to_skel.basis * pole_dir_cam).normalized()
	var ua_rest := skel.get_bone_global_rest(ua)
	var la_rest := skel.get_bone_global_rest(la)
	var hd_rest := skel.get_bone_global_rest(hd)
	var S := ua_rest.origin
	var l1: float = lens[side][0]
	var l2: float = lens[side][1]
	var to_t := T - S
	# Out of reach: the shoulder follows the hand (it's off screen) rather
	# than the fist stopping short of the handle.
	var reach := (l1 + l2) * 0.985
	if to_t.length() > reach:
		S += to_t.normalized() * (to_t.length() - reach)
		to_t = T - S
	var d: float = clamp(to_t.length(), 0.05, l1 + l2 - 0.002)
	var dir := to_t.normalized()
	var a := (l1 * l1 - l2 * l2 + d * d) / (2.0 * d)
	var h := sqrt(max(l1 * l1 - a * a, 0.0))
	var ortho := pole - dir * dir.dot(pole)
	if ortho.length_squared() < 0.0001:
		ortho = Vector3.DOWN
	ortho = ortho.normalized()
	var E := S + dir * a + ortho * h
	var W := S + dir * d
	# Rotate each bone's rest basis so its axis (Y) points along the new segment.
	var q1 := Quaternion(ua_rest.basis.y.normalized(), (E - S).normalized())
	var ua_glob := Transform3D(Basis(q1) * ua_rest.basis, S)
	var q2 := Quaternion(la_rest.basis.y.normalized(), (W - E).normalized())
	var la_glob := Transform3D(Basis(q2) * la_rest.basis, E)
	var hd_glob := Transform3D(Basis(q2) * hd_rest.basis, W)
	if frame.size() == 2:
		var rf := _rest_frame(side)
		var fd: Vector3 = (to_skel.basis * (frame[0] as Vector3)).normalized()
		var pd: Vector3 = to_skel.basis * (frame[1] as Vector3)
		pd = (pd - fd * fd.dot(pd)).normalized()
		var f0: Vector3 = rf[0]
		var p0: Vector3 = (rf[1] - f0 * f0.dot(rf[1])).normalized()
		var r := Basis(fd, pd, fd.cross(pd)) * Basis(f0, p0, f0.cross(p0)).inverse()
		hd_glob.basis = r * hd_rest.basis
	var cl_glob := skel.get_bone_global_pose(cl)
	_set_global(ua, cl_glob, ua_glob)
	_set_global(la, ua_glob, la_glob)
	_set_global(hd, la_glob, hd_glob)


var _grip_offsets := {}

## Where a closed fist's hole sits relative to the wrist, in the hand's
## (finger, palm, finger x palm) frame, in camera-space metres. Measured
## from the curled rest pose, so a handle placed there passes through the
## fist.
func grip_offset(side: String) -> Vector3:
	if _grip_offsets.has(side):
		return _grip_offsets[side]
	if not _thumb_fit.has(side):
		_fit_thumb(side)
	skel.reset_bone_poses()
	_curl(side)
	var h := skel.get_bone_global_pose(bones["hand_" + side]).origin
	var c := Vector3.ZERO
	var n := 0
	for f in ["index", "middle", "ring", "pinky"]:
		for j in [1, 2, 3]:
			var bi := skel.find_bone("%s_0%d_%s" % [f, j, side])
			if bi >= 0:
				c += skel.get_bone_global_pose(bi).origin
				n += 1
	c /= maxi(n, 1)
	var rf := _rest_frame(side)
	var f0: Vector3 = rf[0]
	var p0: Vector3 = (rf[1] - f0 * f0.dot(rf[1])).normalized()
	var d := c - h
	var sc := model.scale.x
	# The joint average sits on the knuckle loop itself; the hole a handle
	# goes through is a little further in toward the palm.
	_grip_offsets[side] = Vector3(d.dot(f0) * 0.62, d.dot(p0) + 0.03, d.dot(f0.cross(p0))) * sc
	skel.reset_bone_poses()
	return _grip_offsets[side]


var curl_angles := [1.25, 1.45, 1.0]
var thumb_angles := [0.75, 0.95, 0.8]
var _fingers := {}

## Close the fingers into a fist round a handle. Each joint bends about
## (finger direction x palm direction), worked out from the rest pose and
## expressed in that bone's own frame, so it curls toward the palm whatever
## the rig's bone rolls are.
func _curl(side: String) -> void:
	if not _fingers.has(side):
		var rf := _rest_frame(side)
		var palm: Vector3 = rf[1]
		var arr := []
		for f in ["index", "middle", "ring", "pinky", "thumb"]:
			for j in 3:
				var bi := skel.find_bone("%s_0%d_%s" % [f, j + 1, side])
				if bi < 0:
					continue
				var g := skel.get_bone_global_rest(bi)
				var nxt := skel.find_bone("%s_0%d_%s" % [f, j + 2, side]) if j < 2 else skel.find_bone("%s_04_leaf_%s" % [f, side])
				var dir: Vector3 = (skel.get_bone_global_rest(nxt).origin - g.origin).normalized() if nxt >= 0 else g.basis.y.normalized()
				var axis := dir.cross(palm).normalized()
				var local := (g.basis.orthonormalized().inverse() * axis).normalized()
				var ang: float = thumb_angles[j] if f == "thumb" else curl_angles[j]
				arr.append([bi, Quaternion(local, ang)])
		_fingers[side] = arr
	var fit: Array = _thumb_fit.get(side, [])
	for e in _fingers[side]:
		var bi: int = e[0]
		var rest := skel.get_bone_rest(bi).basis.get_rotation_quaternion()
		var q: Quaternion = e[1]
		if fit.size() == 3 and _is_thumb(bi):
			q = Quaternion(q.get_axis(), q.get_angle() * float(fit[1]))
			if bi == int(fit[2]):
				q = (fit[0] as Quaternion) * q
		skel.set_bone_pose_rotation(bi, rest * q)


var _thumb_fit := {}

func _is_thumb(bi: int) -> bool:
	return String(skel.get_bone_name(bi)).begins_with("thumb")


## Wrap the thumb over the curled fingers, as in a real grip: search the
## thumb's roll across the palm and how far it bends for the pose that puts
## its tip on the index finger's middle joint. Run once per hand, from rest.
func _fit_thumb(side: String) -> void:
	_thumb_fit[side] = []
	var t1 := skel.find_bone("thumb_01_" + side)
	var tip := skel.find_bone("thumb_04_leaf_" + side)
	if tip < 0:
		tip = skel.find_bone("thumb_03_" + side)
	var i2 := skel.find_bone("index_02_" + side)
	var m2 := skel.find_bone("middle_02_" + side)
	if t1 < 0 or tip < 0 or i2 < 0 or m2 < 0:
		return
	var rf := _rest_frame(side)
	var f_local := (skel.get_bone_global_rest(t1).basis.orthonormalized().inverse() * (rf[0] as Vector3)).normalized()
	var best := INF
	var best_fit := [Quaternion.IDENTITY, 1.0, t1]
	for ri in 17:
		var roll := -1.6 + ri * 0.2
		for si in 5:
			var sc := 0.4 + si * 0.3
			_thumb_fit[side] = [Quaternion(f_local, roll), sc, t1]
			skel.reset_bone_poses()
			_curl(side)
			var target := (skel.get_bone_global_pose(i2).origin + skel.get_bone_global_pose(m2).origin) * 0.5 - (rf[1] as Vector3) * 0.012
			var d := skel.get_bone_global_pose(tip).origin.distance_to(target)
			if d < best:
				best = d
				best_fit = _thumb_fit[side]
	_thumb_fit[side] = best_fit
	skel.reset_bone_poses()


func _set_global(bone: int, parent_glob: Transform3D, glob: Transform3D) -> void:
	var local := parent_glob.affine_inverse() * glob
	skel.set_bone_pose_rotation(bone, local.basis.get_rotation_quaternion())
	skel.set_bone_pose_position(bone, local.origin)
