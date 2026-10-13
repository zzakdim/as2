#!/usr/bin/env python3
"""Build a clothed, dismemberable character from a Quaternius outfit + a base head.

Usage: build_outfit_model.py outfit.gltf head_source.gltf out_dir [Name]

The Modular Character Outfits ship headless (they layer over a Universal Base
Character). This merges every outfit mesh into per-limb parts the way
split_gltf_parts.py does (Human_Head / ArmLeft / HandLeft / LegLeft / Body ...),
then grafts the already-split Human_Head of the base character onto the
outfit's skeleton (same UE-style rig, matched by bone name). Hoods and other
head-group cloth become Human_Helmet so they come off with the head.

Everything ends up in one .gltf + .bin; texture files are referenced by name,
so out_dir must also hold both packs' textures.
"""
import json, struct, sys, os
from collections import Counter

out_src, head_src, out_dir = sys.argv[1], sys.argv[2], sys.argv[3]
name = sys.argv[4] if len(sys.argv) > 4 else os.path.splitext(os.path.basename(out_src))[0]

A = json.load(open(out_src))
B = json.load(open(head_src))
data_a = bytearray(open(os.path.join(os.path.dirname(out_src), A["buffers"][0]["uri"]), "rb").read())
data_b = bytearray(open(os.path.join(os.path.dirname(head_src), B["buffers"][0]["uri"]), "rb").read())

COMP = {5120: ("b", 1), 5121: ("B", 1), 5122: ("h", 2), 5123: ("H", 2), 5125: ("I", 4), 5126: ("f", 4)}
NCOMP = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4, "MAT4": 16}


def read(j, data, acc_i):
    acc = j["accessors"][acc_i]
    bv = j["bufferViews"][acc["bufferView"]]
    fmt, size = COMP[acc["componentType"]]
    n = NCOMP[acc["type"]]
    stride = bv.get("byteStride", size * n)
    off = bv.get("byteOffset", 0) + acc.get("byteOffset", 0)
    return [struct.unpack_from("<" + fmt * n, data, off + i * stride) for i in range(acc["count"])]


def group_of(bone):
    if bone == "Head" or bone.startswith("eye") or bone.startswith("jaw"):
        return "head"
    if bone in ("thigh_l", "calf_l", "foot_l", "ball_l"):
        return "leg_l"
    if bone in ("thigh_r", "calf_r", "foot_r", "ball_r"):
        return "leg_r"
    finger = bone.split("_")[0] in ("index", "middle", "ring", "pinky", "thumb")
    if bone == "hand_l" or (bone.endswith("_l") and finger):
        return "hand_l"
    if bone == "hand_r" or (bone.endswith("_r") and finger):
        return "hand_r"
    if bone.endswith("_l") and not bone.startswith("clavicle"):
        return "arm_l"
    if bone.endswith("_r") and not bone.startswith("clavicle"):
        return "arm_r"
    return "torso"


NAMES = {"hand_l": "Human_HandLeft", "hand_r": "Human_HandRight", "head": "Human_Helmet", "arm_l": "Human_ArmLeft",
         "arm_r": "Human_ArmRight", "leg_l": "Human_LegLeft", "leg_r": "Human_LegRight", "torso": "Human_Body"}

joint_names = [A["nodes"][i]["name"] for i in A["skins"][0]["joints"]]
mesh_nodes = [i for i, n in enumerate(A["nodes"]) if "mesh" in n]
groups = {}   # group -> [primitive]
for ni in mesh_nodes:
    node = A["nodes"][ni]
    whole_head = "Head" in node["name"]   # hoods: keep in one piece
    for prim in A["meshes"][node["mesh"]]["primitives"]:
        joints = read(A, data_a, prim["attributes"]["JOINTS_0"])
        weights = read(A, data_a, prim["attributes"]["WEIGHTS_0"])
        vgroup = [group_of(joint_names[js[max(range(4), key=lambda q: ws[q])]]) for js, ws in zip(joints, weights)]
        idx = [t[0] for t in read(A, data_a, prim["indices"])]
        by = {}
        for t in range(0, len(idx), 3):
            tri = idx[t:t + 3]
            g = "head" if whole_head else Counter(vgroup[v] for v in tri).most_common(1)[0][0]
            by.setdefault(g, []).extend(tri)
        for g, tris in by.items():
            while len(data_a) % 4:
                data_a.append(0)
            off = len(data_a)
            data_a.extend(struct.pack("<%dI" % len(tris), *tris))
            A["bufferViews"].append({"buffer": 0, "byteOffset": off, "byteLength": len(tris) * 4, "target": 34963})
            A["accessors"].append({"bufferView": len(A["bufferViews"]) - 1, "componentType": 5125, "count": len(tris), "type": "SCALAR"})
            p2 = dict(prim)
            p2["indices"] = len(A["accessors"]) - 1
            groups.setdefault(g, []).append(p2)
    node.pop("mesh")
    node.pop("skin", None)
    node["name"] += "_unused"



def merge_same_material(prims):
    """Concatenate primitives that share a material into one (fewer draw calls)."""
    by_mat = {}
    for p in prims:
        by_mat.setdefault((p.get("material"), tuple(sorted(p["attributes"]))), []).append(p)
    out = []
    for (mat, attrs), ps in by_mat.items():
        if len(ps) == 1:
            out.append(ps[0])
            continue
        merged = {"attributes": {}}
        if mat is not None:
            merged["material"] = mat
        base_counts = []
        total = 0
        for p in ps:
            base_counts.append(total)
            total += A["accessors"][p["attributes"]["POSITION"]]["count"]
        for at in attrs:
            acc0 = A["accessors"][ps[0]["attributes"][at]]
            fmt, size = COMP[acc0["componentType"]]
            n = NCOMP[acc0["type"]]
            rows = []
            for p in ps:
                rows.extend(read(A, data_a, p["attributes"][at]))
            while len(data_a) % 4:
                data_a.append(0)
            off = len(data_a)
            for r in rows:
                data_a.extend(struct.pack("<" + fmt * n, *r))
            stride = size * n
            pad = (-stride) % 4
            if pad:
                # Re-pack with 4-byte aligned stride (glTF requires it for vertex attributes).
                del data_a[off:]
                for r in rows:
                    data_a.extend(struct.pack("<" + fmt * n, *r) + b"\0" * pad)
                stride += pad
            bv = {"buffer": 0, "byteOffset": off, "byteLength": len(data_a) - off, "target": 34962}
            if pad:
                bv["byteStride"] = stride
            A["bufferViews"].append(bv)
            acc = {"bufferView": len(A["bufferViews"]) - 1, "componentType": acc0["componentType"], "count": len(rows), "type": acc0["type"]}
            if acc0.get("normalized"):
                acc["normalized"] = True
            if at == "POSITION":
                acc["min"] = [min(r[i] for r in rows) for i in range(3)]
                acc["max"] = [max(r[i] for r in rows) for i in range(3)]
            A["accessors"].append(acc)
            merged["attributes"][at] = len(A["accessors"]) - 1
        idx = []
        for p, bc in zip(ps, base_counts):
            idx.extend(t[0] + bc for t in read(A, data_a, p["indices"]))
        while len(data_a) % 4:
            data_a.append(0)
        off = len(data_a)
        data_a.extend(struct.pack("<%dI" % len(idx), *idx))
        A["bufferViews"].append({"buffer": 0, "byteOffset": off, "byteLength": len(idx) * 4, "target": 34963})
        A["accessors"].append({"bufferView": len(A["bufferViews"]) - 1, "componentType": 5125, "count": len(idx), "type": "SCALAR"})
        merged["indices"] = len(A["accessors"]) - 1
        out.append(merged)
    return out


for g in groups:
    groups[g] = merge_same_material(groups[g])

armature = next(n for n in A["nodes"] if any(c in n.get("children", []) for c in mesh_nodes))
skin_a = A["nodes"][mesh_nodes[0]].get("skin", 0)
for g, prims in groups.items():
    A["meshes"].append({"name": name + "_" + g, "primitives": prims})
    A["nodes"].append({"name": NAMES[g], "mesh": len(A["meshes"]) - 1, "skin": skin_a})
    armature["children"].append(len(A["nodes"]) - 1)
    print(g, sum(A["accessors"][p["indices"]]["count"] for p in prims) // 3, "tris,", len(prims), "prims")

# ------------------------------------------------------------ graft the head
while len(data_a) % 4:
    data_a.append(0)
b_off = len(data_a)
data_a.extend(data_b)
bv_map, acc_map, img_map, tex_map, smp_map, mat_map = {}, {}, {}, {}, {}, {}


def map_bv(i):
    if i not in bv_map:
        bv = dict(B["bufferViews"][i])
        bv["buffer"] = 0
        bv["byteOffset"] = bv.get("byteOffset", 0) + b_off
        A["bufferViews"].append(bv)
        bv_map[i] = len(A["bufferViews"]) - 1
    return bv_map[i]


def map_acc(i):
    if i not in acc_map:
        acc = dict(B["accessors"][i])
        acc["bufferView"] = map_bv(acc["bufferView"])
        A["accessors"].append(acc)
        acc_map[i] = len(A["accessors"]) - 1
    return acc_map[i]


def map_tex(i):
    if i not in tex_map:
        t = dict(B["textures"][i])
        if "source" in t:
            s = t["source"]
            if s not in img_map:
                A.setdefault("images", []).append(dict(B["images"][s]))
                img_map[s] = len(A["images"]) - 1
            t["source"] = img_map[s]
        if "sampler" in t:
            s = t["sampler"]
            if s not in smp_map:
                A.setdefault("samplers", []).append(dict(B["samplers"][s]))
                smp_map[s] = len(A["samplers"]) - 1
            t["sampler"] = smp_map[s]
        A.setdefault("textures", []).append(t)
        tex_map[i] = len(A["textures"]) - 1
    return tex_map[i]


def remap_texrefs(o):
    if isinstance(o, dict):
        for k, v in o.items():
            if isinstance(v, dict) and "index" in v and k.lower().endswith("texture"):
                v["index"] = map_tex(v["index"])
            else:
                remap_texrefs(v)
    elif isinstance(o, list):
        for v in o:
            remap_texrefs(v)


def map_mat(i):
    if i not in mat_map:
        m = json.loads(json.dumps(B["materials"][i]))
        remap_texrefs(m)
        A["materials"].append(m)
        mat_map[i] = len(A["materials"]) - 1
    return mat_map[i]


head_node = next(n for n in B["nodes"] if n.get("name") == "Human_Head")
new_prims = []
for prim in B["meshes"][head_node["mesh"]]["primitives"]:
    p = {"attributes": {k: map_acc(v) for k, v in prim["attributes"].items()}, "indices": map_acc(prim["indices"])}
    if "material" in prim:
        p["material"] = map_mat(prim["material"])
    if "mode" in prim:
        p["mode"] = prim["mode"]
    new_prims.append(p)
A["meshes"].append({"name": name + "_head", "primitives": new_prims})
skin_b = B["skins"][head_node["skin"]]
by_name = {n["name"]: i for i, n in enumerate(A["nodes"]) if "mesh" not in n}
A["skins"].append({"name": "HeadSkin", "joints": [by_name[B["nodes"][jn]["name"]] for jn in skin_b["joints"]],
                   "inverseBindMatrices": map_acc(skin_b["inverseBindMatrices"])})
A["nodes"].append({"name": "Human_Head", "mesh": len(A["meshes"]) - 1, "skin": len(A["skins"]) - 1})
armature["children"].append(len(A["nodes"]) - 1)

# Compact: keep only what the remaining meshes and skins still reference.
used_acc = set()
for m in A["meshes"]:
    if not any(n.get("mesh") == A["meshes"].index(m) for n in A["nodes"]):
        continue
    for p in m["primitives"]:
        used_acc.update(p["attributes"].values())
        used_acc.add(p["indices"])
for sk in A["skins"]:
    if "inverseBindMatrices" in sk:
        used_acc.add(sk["inverseBindMatrices"])
used_bv = sorted({A["accessors"][i]["bufferView"] for i in used_acc})
new_data = bytearray()
bv_new = {}
for i in used_bv:
    bv = A["bufferViews"][i]
    while len(new_data) % 4:
        new_data.append(0)
    o = bv.get("byteOffset", 0)
    nb = dict(bv)
    nb["byteOffset"] = len(new_data)
    new_data.extend(data_a[o:o + bv["byteLength"]])
    bv_new[i] = nb
old_to_new_bv = {i: k for k, i in enumerate(used_bv)}
acc_old = sorted(used_acc)
acc_new = {i: k for k, i in enumerate(acc_old)}
A["bufferViews"] = [bv_new[i] for i in used_bv]
A["accessors"] = [dict(A["accessors"][i], bufferView=old_to_new_bv[A["accessors"][i]["bufferView"]]) for i in acc_old]
for m in A["meshes"]:
    for p in m["primitives"]:
        p["attributes"] = {k: acc_new.get(v, 0) for k, v in p["attributes"].items()}
        p["indices"] = acc_new.get(p["indices"], 0)
live = [i for i, m in enumerate(A["meshes"]) if any(n.get("mesh") == i for n in A["nodes"])]
mesh_new = {i: k for k, i in enumerate(live)}
A["meshes"] = [A["meshes"][i] for i in live]
for n in A["nodes"]:
    if "mesh" in n:
        n["mesh"] = mesh_new[n["mesh"]]
for sk in A["skins"]:
    if "inverseBindMatrices" in sk:
        sk["inverseBindMatrices"] = acc_new[sk["inverseBindMatrices"]]
data_a = new_data

os.makedirs(out_dir, exist_ok=True)
A["buffers"] = [{"uri": name + ".bin", "byteLength": len(data_a)}]
open(os.path.join(out_dir, name + ".bin"), "wb").write(data_a)
json.dump(A, open(os.path.join(out_dir, name + ".gltf"), "w"))
print("wrote", os.path.join(out_dir, name + ".gltf"), "images:", [im.get("uri") for im in A.get("images", [])])
