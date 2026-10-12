class_name Pickup
extends Usable
## A weapon or item lying in the world. Using it swaps with what you carry.

var item_id := "pistol"
var model: Node3D
var label: Label3D
var _t := 0.0


static func create(id: String, pos: Vector3) -> Pickup:
	var p := Pickup.new()
	p.item_id = id
	p.position = pos
	return p


func _ready() -> void:
	use_radius = 2.4 if item_id == "ammo" else 2.0
	model = WeaponData.build_model(item_id)
	model.rotation = Vector3(0, randf() * TAU, PI / 2 if WeaponData.DEFS.has(item_id) else 0.0)
	model.position.y = 0.08
	add_child(model)
	label = Label3D.new()
	label.text = WeaponData.display_name(item_id)
	label.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	label.no_depth_test = true
	label.fixed_size = true
	label.pixel_size = 0.0012
	label.font_size = 22
	label.outline_size = 6
	label.modulate = Color(0.75, 0.85, 1.0)
	label.position.y = 0.5
	label.visible = false
	add_child(label)


func _process(delta: float) -> void:
	_t += delta
	if _t < 0.25:
		return
	_t = 0.0
	# Items glow (label) when the player is close, like L4D's item outlines.
	var p = Game.player
	label.visible = p != null and is_instance_valid(p) and p.global_position.distance_to(global_position) < 7.0


func get_prompt(s) -> String:
	if item_id == "ammo":
		return "Refill ammo"
	return "Pick up " + WeaponData.display_name(item_id)


func can_use(s) -> bool:
	return enabled and s.can_take(item_id)


func on_use(s) -> void:
	var dropped: String = s.take_item(item_id)
	Game.sfx.play3d("pickup", global_position, -6.0)
	if item_id == "ammo":
		return
	if dropped == "":
		queue_free()
	else:
		item_id = dropped
		model.queue_free()
		model = WeaponData.build_model(item_id)
		model.rotation = Vector3(0, randf() * TAU, PI / 2 if WeaponData.DEFS.has(item_id) else 0.0)
		model.position.y = 0.08
		add_child(model)
		label.text = WeaponData.display_name(item_id)
