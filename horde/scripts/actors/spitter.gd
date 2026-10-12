class_name Spitter
extends SpecialInfected
## Lobs acid that pools and burns harder the longer you stand in it.

var phase := "stalk"
var phase_t := 0.0


func _ready() -> void:
	kind = "spitter"
	max_hp = 100.0
	hp = max_hp
	run_speed = 5.4
	tell_sound = "spitter_hiss"
	rig = BodyRig.make({
		"skin": Color(0.5, 0.6, 0.35), "shirt": Color(0.25, 0.3, 0.2), "pants": Color(0.2, 0.22, 0.18),
		"scale": 1.05, "torso": Vector3(0.36, 0.7, 0.22), "head": 0.24, "eyes": Color(0.5, 1.0, 0.2),
	})
	super._ready()


func special_think() -> void:
	if phase == "retreat":
		return
	var t = pick_target()
	if t == null:
		desired = Vector3.ZERO
		return
	var d: float = t.global_position.distance_to(global_position)
	var vis: bool = d < 30.0 and Game.level.los(global_position, t.global_position)
	if vis and d < 25.0 and d > 4.0 and ability_cd <= 0.0:
		_spit(t)
		return
	rig.set_pose("zombie")
	if vis and d < 18.0:
		desired = Vector3.ZERO
	else:
		steer_to(t.global_position, run_speed, false)


func special_physics(delta: float) -> void:
	if phase == "retreat":
		phase_t -= delta
		var t0 = Game.nearest_survivor(global_position)
		if t0:
			var away: Vector3 = global_position - t0.global_position
			away.y = 0
			desired = away.normalized() * run_speed
		if phase_t <= 0.0:
			phase = "stalk"


func _spit(t) -> void:
	ability_cd = 12.0
	phase = "retreat"
	phase_t = 3.0
	rig.swing(0.4)
	Game.sfx.play3d("spit", global_position + Vector3(0, 1.6, 0), 2.0)
	var target: Vector3 = t.global_position + t.velocity * 0.6
	var p := Projectile.new()
	p.kind = "acid"
	Game.world.add_child(p)
	p.global_position = global_position + Vector3(0, 1.8, 0)
	p.launch_to(target, 1.0)


func on_death() -> void:
	Hazard.spawn_acid(Vector3(global_position.x, 0.05, global_position.z), 1.6, 3.0)
