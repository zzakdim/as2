class_name Usable
extends Node3D
## Anything a survivor can press E on: pickups, doors, buttons, the radio.

var prompt := "Use"
var hold_time := 0.0          # 0 = instant, otherwise seconds to hold E
var use_radius := 2.2
var enabled := true


func _enter_tree() -> void:
	if not Game.usables.has(self):
		Game.usables.append(self)


func _exit_tree() -> void:
	Game.usables.erase(self)


func use_point() -> Vector3:
	return global_position


func can_use(_s) -> bool:
	return enabled


func get_prompt(_s) -> String:
	return prompt


func on_use(_s) -> void:
	pass
