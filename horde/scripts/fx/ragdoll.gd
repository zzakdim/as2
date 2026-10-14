class_name Ragdoll
extends Node3D
## Turns a BodyRig into jointed rigid bodies on death and launches it with
## the killing blow. Supports cuts: decapitation, head split, arm loss and
## bisection at the waist. Corpses settle, freeze, then get cleaned up.

const LAYER_DEBRIS := 16
const MAX_ACTIVE := 36
const FREEZE_AFTER := 5.0
const LIFETIME := 30.0

static var active: Array = []

var bodies := {}
var age := 0.0
var frozen := false


## cut: "", "decap", "split", "arm", "bisect", "gib" (explosion).
static func from_rig(rig: BodyRig, velocity: Vector3, impulse: Vector3, point: Vector3, cut := "") -> Ragdoll:
	var r := Ragdoll.new()
	Game.world.add_child(r)
	r._build(rig, velocity, impulse, point, cut)
	active.append(r)
	while active.size() > MAX_ACTIVE:
		var old = active.pop_front()
		if is_instance_valid(old):
			old.queue_free()
	return r


func _exit_tree() -> void:
	active.erase(self)


func _build(rig: BodyRig, velocity: Vector3, impulse: Vector3, point: Vector3, cut: String) -> void:
	var parts := {
		"torso": rig.torso, "head": rig.head, "arm_l": rig.arm_l, "arm_r": rig.arm_r,
		"leg_l": rig.leg_l, "leg_r": rig.leg_r,
	}
	var part_nodes := {}
	for k in parts:
		part_nodes[parts[k]] = true
	var masses := {"torso": 3.0, "head": 0.7, "arm_l": 0.8, "arm_r": 0.8, "leg_l": 1.4, "leg_r": 1.4}
	var cut_arm := ""
	if cut == "arm":
		cut_arm = "arm_l" if randf() < 0.5 else "arm_r"
	for k in parts:
		var node: Node3D = parts[k]
		if node == null or not node.is_visible_in_tree():
			continue
		if k == "head" and cut == "split":
			Game.fx.gib_burst(node.global_position, impulse.normalized(), 0.26)
			continue
		var meshes: Array = []
		_collect(node, part_nodes, meshes, true)
		if meshes.is_empty():
			continue
		var body := RigidBody3D.new()
		body.collision_layer = LAYER_DEBRIS
		body.collision_mask = Game.LAYER_WORLD
		body.mass = masses.get(k, 1.0)
		body.linear_damp = 0.3
		body.angular_damp = 1.5
		add_child(body)
		body.global_transform = node.global_transform
		var inv := node.global_transform.affine_inverse()
		var aabb := AABB()
		var first := true
		for m in meshes:
			var mi := m as MeshInstance3D
			var dup := MeshInstance3D.new()
			dup.mesh = mi.mesh
			dup.material_override = mi.material_override
			dup.transform = inv * mi.global_transform
			body.add_child(dup)
			var bb: AABB = dup.transform * mi.mesh.get_aabb()
			aabb = bb if first else aabb.merge(bb)
			first = false
		var cs := CollisionShape3D.new()
		var sh := BoxShape3D.new()
		sh.size = aabb.size.max(Vector3(0.08, 0.08, 0.08))
		cs.shape = sh
		cs.position = aabb.get_center()
		body.add_child(cs)
		body.linear_velocity = velocity
		bodies[k] = body
	# Joints
	var torso: RigidBody3D = bodies.get("torso")
	if torso == null:
		return
	for k in ["head", "arm_l", "arm_r", "leg_l", "leg_r"]:
		if not bodies.has(k):
			continue
		var severed := false
		if k == "head" and cut == "decap":
			severed = true
		if k == cut_arm:
			severed = true
		if (k == "leg_l" or k == "leg_r") and cut == "bisect":
			severed = true
		if cut == "gib" and randf() < 0.7:
			severed = true
		if severed:
			_spurt(torso, parts[k].global_position)
			bodies[k].apply_central_impulse(impulse * 0.4 + Vector3(0, 2.0, 0) * bodies[k].mass)
			bodies[k].angular_velocity = Vector3(randf_range(-10, 10), randf_range(-10, 10), randf_range(-10, 10))
			continue
		var j := ConeTwistJoint3D.new()
		add_child(j)
		var anchor: Vector3 = parts[k].global_position
		if k == "head":
			anchor = parts[k].global_position - parts[k].global_basis.y * 0.12
		j.global_position = anchor
		j.node_a = j.get_path_to(torso)
		j.node_b = j.get_path_to(bodies[k])
		j.set_param(ConeTwistJoint3D.PARAM_SWING_SPAN, deg_to_rad(70.0 if k.begins_with("arm") else 45.0))
		j.set_param(ConeTwistJoint3D.PARAM_TWIST_SPAN, deg_to_rad(25.0))
	if cut == "bisect" and bodies.has("leg_l") and bodies.has("leg_r"):
		var jl := ConeTwistJoint3D.new()
		add_child(jl)
		jl.global_position = (parts["leg_l"].global_position + parts["leg_r"].global_position) * 0.5
		jl.node_a = jl.get_path_to(bodies["leg_l"])
		jl.node_b = jl.get_path_to(bodies["leg_r"])
		_spurt(bodies["leg_l"], jl.global_position)
		Game.fx.gib_burst(jl.global_position + Vector3(0, 0.1, 0), impulse.normalized(), 0.18)
	if cut == "decap" or cut == "split":
		_spurt(torso, parts["head"].global_position)
	# The killing blow: push the body part nearest the hit, and some of the torso.
	var nearest: RigidBody3D = torso
	var nd := INF
	for k in bodies:
		var d: float = bodies[k].global_position.distance_to(point)
		if d < nd:
			nd = d
			nearest = bodies[k]
	nearest.apply_impulse(impulse * 0.6, point - nearest.global_position)
	torso.apply_central_impulse(impulse * 0.5)
	if cut == "bisect":
		torso.apply_central_impulse(Vector3(0, 3.5, 0) + impulse * 0.3)
		torso.angular_velocity += impulse.normalized().cross(Vector3.UP) * -6.0


func _collect(node: Node, part_nodes: Dictionary, out: Array, is_root: bool) -> void:
	if node is MeshInstance3D and node.visible:
		out.append(node)
	for c in node.get_children():
		if not is_root or true:
			if part_nodes.has(c):
				continue
			if c is Node3D and c.visible:
				_collect(c, part_nodes, out, false)


func _spurt(body: RigidBody3D, at: Vector3) -> void:
	var p: CPUParticles3D = Game.fx.make_spurt()
	body.add_child(p)
	p.global_position = at
	p.emitting = true
	Effects.after(p, 1.6, p.set.bind("emitting", false))


func _physics_process(delta: float) -> void:
	age += delta
	if not frozen and age > FREEZE_AFTER:
		frozen = true
		for k in bodies:
			var b: RigidBody3D = bodies[k]
			if is_instance_valid(b):
				b.freeze = true
		Game.fx.blood_decal(bodies["torso"].global_position if bodies.has("torso") and is_instance_valid(bodies["torso"]) else global_position)
	if age > LIFETIME:
		queue_free()
