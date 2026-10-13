#!/usr/bin/env python3
"""Split a skinned glTF body mesh into dismemberable parts by skin weight.

Usage: split_gltf_parts.py in.gltf out_dir NodeName
Each triangle goes to the part (head / arm_l / arm_r / hand_l / hand_r / leg_l / leg_r / torso)
of the bone that dominates its vertices. All parts share the original vertex
buffers and skin, so the intact body renders exactly as before; hiding a part
cleanly removes that limb. Output nodes are named Human_Head, Human_ArmLeft,
Human_ArmRight, Human_LegLeft, Human_LegRight, Human_Body.
"""
import json, struct, sys, os, shutil
from collections import Counter

src, out_dir, node_name = sys.argv[1], sys.argv[2], sys.argv[3]
j = json.load(open(src))
base = os.path.dirname(src)
bin_uri = j["buffers"][0]["uri"]
data = bytearray(open(os.path.join(base, bin_uri), "rb").read())

COMP = {5120: ("b", 1), 5121: ("B", 1), 5122: ("h", 2), 5123: ("H", 2), 5125: ("I", 4), 5126: ("f", 4)}
NCOMP = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4}

def read(acc_i):
    acc = j["accessors"][acc_i]
    bv = j["bufferViews"][acc["bufferView"]]
    fmt, size = COMP[acc["componentType"]]
    n = NCOMP[acc["type"]]
    stride = bv.get("byteStride", size * n)
    off = bv.get("byteOffset", 0) + acc.get("byteOffset", 0)
    out = []
    for i in range(acc["count"]):
        o = off + i * stride
        out.append(struct.unpack_from("<" + fmt * n, data, o))
    return out

joint_names = [j["nodes"][i]["name"] for i in j["skins"][0]["joints"]]

def group_of(name):
    if name in ("Head",) or name.startswith("eye") or name.startswith("jaw"):
        return "head"
    if name in ("thigh_l", "calf_l", "foot_l", "ball_l"):
        return "leg_l"
    if name in ("thigh_r", "calf_r", "foot_r", "ball_r"):
        return "leg_r"
    if name == "hand_l" or (name.endswith("_l") and name.split("_")[0] in ("index", "middle", "ring", "pinky", "thumb")):
        return "hand_l"
    if name == "hand_r" or (name.endswith("_r") and name.split("_")[0] in ("index", "middle", "ring", "pinky", "thumb")):
        return "hand_r"
    if name.endswith("_l") and not name.startswith("clavicle"):
        return "arm_l"
    if name.endswith("_r") and not name.startswith("clavicle"):
        return "arm_r"
    return "torso"

node_i = next(i for i, n in enumerate(j["nodes"]) if n.get("name") == node_name)
node = j["nodes"][node_i]
mesh = j["meshes"][node["mesh"]]
parts = {}
for prim in mesh["primitives"]:
    joints = read(prim["attributes"]["JOINTS_0"])
    weights = read(prim["attributes"]["WEIGHTS_0"])
    acc_w = j["accessors"][prim["attributes"]["WEIGHTS_0"]]
    vgroup = []
    for js, ws in zip(joints, weights):
        k = max(range(4), key=lambda q: ws[q])
        vgroup.append(group_of(joint_names[js[k]]))
    idx = [t[0] for t in read(prim["indices"])]
    for t in range(0, len(idx), 3):
        tri = idx[t:t + 3]
        g = Counter(vgroup[v] for v in tri).most_common(1)[0][0]
        parts.setdefault(g, {}).setdefault(id(prim), (prim, []))[1].extend(tri)

NAMES = {"hand_l": "Human_HandLeft", "hand_r": "Human_HandRight", "head": "Human_Head", "arm_l": "Human_ArmLeft", "arm_r": "Human_ArmRight",
         "leg_l": "Human_LegLeft", "leg_r": "Human_LegRight", "torso": "Human_Body"}
armature = next(n for n in j["nodes"] if node_i in n.get("children", []))
new_nodes = []
for g, prims in parts.items():
    new_prims = []
    for prim, tris in prims.values():
        while len(data) % 4:
            data.append(0)
        off = len(data)
        data.extend(struct.pack("<%dI" % len(tris), *tris))
        j["bufferViews"].append({"buffer": 0, "byteOffset": off, "byteLength": len(tris) * 4, "target": 34963})
        j["accessors"].append({"bufferView": len(j["bufferViews"]) - 1, "componentType": 5125, "count": len(tris), "type": "SCALAR"})
        p2 = dict(prim)
        p2["indices"] = len(j["accessors"]) - 1
        new_prims.append(p2)
    j["meshes"].append({"name": mesh["name"] + "_" + g, "primitives": new_prims})
    nn = {"name": NAMES[g], "mesh": len(j["meshes"]) - 1, "skin": node["skin"]}
    j["nodes"].append(nn)
    new_nodes.append(len(j["nodes"]) - 1)
    print(g, sum(len(t) for _, t in prims.values()) // 3, "triangles")
# Replace the original node with the parts.
armature["children"] = [c for c in armature["children"] if c != node_i] + new_nodes
node.pop("mesh", None)
node.pop("skin", None)
node["name"] = node_name + "_unused"

os.makedirs(out_dir, exist_ok=True)
stem = os.path.splitext(os.path.basename(src))[0]
j["buffers"][0]["uri"] = stem + ".bin"
j["buffers"][0]["byteLength"] = len(data)
open(os.path.join(out_dir, stem + ".bin"), "wb").write(data)
json.dump(j, open(os.path.join(out_dir, stem + ".gltf"), "w"))
print("wrote", os.path.join(out_dir, stem + ".gltf"))
