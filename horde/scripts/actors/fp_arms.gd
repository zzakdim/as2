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


static func available() -> bool:
	return ResourceLoader.exists(MODEL) or ResourceLoader.exists(MODEL_BARE)


func setup(shirt: Color) -> void:
	var dressed := ResourceLoader.exists(MODEL)
	model = load(MODEL if dressed else MODEL_BARE).instantiate()
	add_child(model)
	model.rotation.y = PI
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
						if base and not base.resource_name.contains("Regular") and not base.resource_name.contains("Superhero"):
							var m: StandardMaterial3D = base.duplicate()
							m.albedo_color = Color(1, 1, 1).lerp(shirt.lightened(0.35), 0.55)
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
	model.position = Vector3(0, -0.34 - sh.y, 0.12 + sh.z)


## Pose both arms. Targets are wrist positions in camera space; pass
## Vector3.INF for an arm that should hang out of view.
func pose(wrist_r: Vector3, wrist_l: Vector3) -> void:
	if skel == null:
		return
	skel.reset_bone_poses()
	_solve("r", wrist_r, Vector3(0.6, -1.0, 0.4))
	_solve("l", wrist_l, Vector3(-0.6, -1.0, 0.4))
	_curl("r")
	_curl("l")


func _solve(side: String, target_cam: Vector3, pole_dir_cam: Vector3) -> void:
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
	var cl_glob := skel.get_bone_global_pose(cl)
	_set_global(ua, cl_glob, ua_glob)
	_set_global(la, ua_glob, la_glob)
	_set_global(hd, la_glob, hd_glob)


var curl_axis := Vector3(0, 0, 1)
var curl_angles := [1.2, 1.3, 0.9]
var _fingers := {}

## Close the fingers into a grip (rest pose has them straight).
func _curl(side: String) -> void:
	if not _fingers.has(side):
		var arr := []
		for f in ["index", "middle", "ring", "pinky"]:
			for j in 3:
				var bi := skel.find_bone("%s_0%d_%s" % [f, j + 1, side])
				if bi >= 0:
					arr.append([bi, j])
		_fingers[side] = arr
	var ax: Vector3 = curl_axis if side == "l" else -curl_axis   # mirrored rig
	for e in _fingers[side]:
		var bi: int = e[0]
		var rest := skel.get_bone_rest(bi).basis.get_rotation_quaternion()
		skel.set_bone_pose_rotation(bi, rest * Quaternion(ax, curl_angles[e[1]]))


func _set_global(bone: int, parent_glob: Transform3D, glob: Transform3D) -> void:
	var local := parent_glob.affine_inverse() * glob
	skel.set_bone_pose_rotation(bone, local.basis.get_rotation_quaternion())
	skel.set_bone_pose_position(bone, local.origin)
