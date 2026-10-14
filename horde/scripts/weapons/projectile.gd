class_name Projectile
extends Node3D
## Ballistic projectile thrown by infected: spitter acid glob, tank rock.

var kind := "acid"
var vel := Vector3.ZERO
var owner_inf = null
var age := 0.0
const GRAV := 14.0


func _ready() -> void:
	if kind == "rock":
		Mats.add_mesh(self, Mats.sphere(0.45, 8), Mats.concrete())
	else:
		Mats.add_mesh(self, Mats.sphere(0.18, 8), Mats.emissive(Color(0.4, 1.0, 0.2), 2.0))


## Solve for a launch velocity that lands on `target` after `flight` seconds.
func launch_to(target: Vector3, flight: float) -> void:
	var d := target - global_position
	vel = Vector3(d.x / flight, (d.y + 0.5 * GRAV * flight * flight) / flight, d.z / flight)


func _physics_process(delta: float) -> void:
	age += delta
	vel.y -= GRAV * delta
	var next := global_position + vel * delta
	var lvl = Game.level
	if kind == "rock":
		rotate_x(delta * 6.0)
		for s in Game.survivors:
			if is_instance_valid(s) and not s.dead and (s.global_position + Vector3(0, 1, 0)).distance_to(next) < 1.1:
				s.take_damage(24.0 * Game.special_damage_mult(), owner_inf, "rock")
				var push := Vector3(vel.x, 0, vel.z).normalized()
				s.knockback(push * 6.0 + Vector3(0, 3, 0), 1.2)
				_shatter()
				return
	var c: Vector2i = lvl.cell_of(next)
	var blocked: bool = not lvl.in_bounds(c) or lvl.is_wallish(lvl.get_t(c.x, c.y))
	if next.y <= 0.05 or blocked or age > 5.0:
		if kind == "acid":
			var p := global_position
			p.y = 0.05
			Hazard.spawn_acid(p, 3.0, 7.0)
			Game.sfx.play3d("spit", p, 0.0)
		else:
			_shatter()
			return
		queue_free()
		return
	global_position = next


func _shatter() -> void:
	Game.sfx.play3d("tank_punch", global_position, 2.0)
	Game.fx.impact(global_position, Vector3.UP)
	Game.fx.add_shake(global_position, 0.5)
	queue_free()
