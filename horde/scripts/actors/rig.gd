class_name Rig
extends Node3D
## Common interface for character visuals. BodyRig (procedural boxes) and
## SkinnedRig (imported animated models) both implement it, so actors and AI
## never care which one they drive.

var pose := "idle"          # idle, walk, zombie, aim, crouch, sit, incap, pinned, dead
var held: Node3D            # attach point for a held weapon (barrel along -Z)


func set_pose(p: String) -> void:
	pose = p

func animate(_delta: float, _speed: float) -> void:
	pass

func swing(_dur := 0.4) -> void:
	pass

func flinch(_local_dir: Vector3, _force: float) -> void:
	pass

func die(_from_dir: Vector3) -> void:
	pose = "dead"

func gib_head() -> void:
	pass

func gib_arm() -> void:
	pass

## Turn into a ragdoll launched by `impulse` at `point`, with a cut type
## ("", "decap", "split", "arm", "bisect", "gib"). Returns true if handled.
func ragdoll(_velocity: Vector3, _impulse: Vector3, _point: Vector3, _cut: String) -> bool:
	return false
