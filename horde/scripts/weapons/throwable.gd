class_name Throwable
extends RigidBody3D
## Pipe bomb (beeps, lures the horde, explodes), molotov (fire on impact)
## and bile jar (lures the horde to the splash point).

var kind := "pipe_bomb"
var thrower = null
var fuse := 6.0
var beep_t := 0.0
var broken := false
var radius := 35.0   # attractor radius
var _light: OmniLight3D


static func create(k: String, by) -> Throwable:
	var t := Throwable.new()
	t.kind = k
	t.thrower = by
	return t


func _ready() -> void:
	collision_layer = Game.LAYER_PROJECTILE
	collision_mask = Game.LAYER_WORLD
	mass = 0.6
	continuous_cd = true
	contact_monitor = true
	max_contacts_reported = 2
	var pm := PhysicsMaterial.new()
	pm.bounce = 0.35 if kind == "pipe_bomb" else 0.0
	pm.friction = 0.8
	physics_material_override = pm
	var cs := CollisionShape3D.new()
	var sh := SphereShape3D.new()
	sh.radius = 0.08
	cs.shape = sh
	add_child(cs)
	add_child(WeaponData.build_model(kind))
	body_entered.connect(_on_hit)
	if kind == "pipe_bomb":
		_light = OmniLight3D.new()
		_light.light_color = Color(1, 0.1, 0.1)
		_light.omni_range = 3.0
		_light.light_energy = 0.0
		add_child(_light)
		Game.attractors.append(self)
		Game.make_noise(global_position, radius)


func _exit_tree() -> void:
	Game.attractors.erase(self)


func _physics_process(delta: float) -> void:
	if kind != "pipe_bomb":
		if global_position.y < -5.0:
			queue_free()
		return
	fuse -= delta
	beep_t -= delta
	var interval: float = clamp(fuse / 6.0, 0.08, 1.0) * 0.6
	if beep_t <= 0.0:
		beep_t = interval
		Game.sfx.play3d("beep", global_position, -2.0)
		_light.light_energy = 3.0
		Game.make_noise(global_position, radius)
	else:
		_light.light_energy = max(0.0, _light.light_energy - delta * 20.0)
	if fuse <= 0.0:
		Game.fx.explosion(global_position, 6.5, 300.0, thrower)
		queue_free()


func _on_hit(_body: Node) -> void:
	if broken or kind == "pipe_bomb":
		return
	broken = true
	var p := global_position
	p.y = 0.05
	Game.sfx.play3d("glass", p, 0.0)
	if kind == "molotov":
		Hazard.spawn_fire(p, 4.0, 15.0, thrower)
	elif kind == "bile_jar":
		var a := Hazard.spawn_bile_cloud(p, 20.0)
		Game.make_noise(p, a.radius)
		# Commons caught in the splash become targets for their friends.
		for z in Game.infected:
			if is_instance_valid(z) and not z.is_dead() and z.global_position.distance_to(p) < 4.0 and not z.is_special:
				z.alert(null)
	queue_free()
