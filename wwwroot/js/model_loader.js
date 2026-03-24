
window.ModelLoader = {
    loadProceduralModel: async function (scene, modelName, color, position = [0, 0, 0]) {
        try {
            const response = await fetch(`models/${modelName}.json`);
            const data = await response.json();
            
            const root = new BABYLON.TransformNode(data.Name || modelName, scene);
            root.position = new BABYLON.Vector3(position[0], position[1], position[2]);

            const meshMap = {};
            const materials = {};

            data.Parts.forEach(part => {
                let mesh;
                const options = {};

                switch (part.Shape) {
                    case "Box":
                        options.width = part.Scale[0];
                        options.height = part.Scale[1];
                        options.depth = part.Scale[2];
                        mesh = BABYLON.MeshBuilder.CreateBox(part.Id, options, scene);
                        break;
                    case "Cylinder":
                        options.diameterTop = part.Scale[0];
                        options.diameterBottom = part.Scale[0];
                        options.height = part.Scale[1];
                        mesh = BABYLON.MeshBuilder.CreateCylinder(part.Id, options, scene);
                        break;
                    case "Sphere":
                        options.diameterX = part.Scale[0];
                        options.diameterY = part.Scale[1];
                        options.diameterZ = part.Scale[2];
                        mesh = BABYLON.MeshBuilder.CreateSphere(part.Id, options, scene);
                        break;
                    case "Capsule":
                        options.radius = part.Scale[0] / 2;
                        options.height = part.Scale[1];
                        mesh = BABYLON.MeshBuilder.CreateCapsule(part.Id, options, scene);
                        break;
                    case "Torus":
                        options.diameter = part.Scale[0];
                        options.thickness = part.Scale[1];
                        mesh = BABYLON.MeshBuilder.CreateTorus(part.Id, options, scene);
                        break;
                    case "Cone":
                        options.diameterTop = 0;
                        options.diameterBottom = part.Scale[0];
                        options.height = part.Scale[1];
                        mesh = BABYLON.MeshBuilder.CreateCylinder(part.Id, options, scene);
                        break;
                }

                if (mesh) {
                    meshMap[part.Id] = mesh;

                    // Smarter Color Override Logic for Team Differentiation
                    let partColor = part.ColorHex;
                    if (color === "Black") {
                        const baseColor = BABYLON.Color3.FromHexString(partColor);
                        // If the color is "light" (high value and low saturation), we turn it into dark obsidian
                        // This targets the main "White" parts of the Radiant models.
                        const hsv = baseColor.toHSV();
                        if (hsv.v > 0.7 && hsv.s < 0.3) {
                            // This part is "White" or "Light", make it dark obsidian/void
                            partColor = "#1a1a1a"; 
                        } else {
                            // This part is equipment or skin, keep it but darken it slightly for a "Shadow" feel
                            hsv.v *= 0.6;
                            const shadowColor = BABYLON.Color3.FromHSV(hsv.h, hsv.s, hsv.v);
                            partColor = shadowColor.toHexString();
                        }
                    }

                    const matKey = partColor + "_" + (part.Material || "Standard");
                    if (!materials[matKey]) {
                        const mat = new BABYLON.StandardMaterial(matKey, scene);
                        mat.diffuseColor = BABYLON.Color3.FromHexString(partColor);
                        if (part.Material === "Glow") {
                            mat.emissiveColor = mat.diffuseColor;
                        }
                        materials[matKey] = mat;
                    }
                    mesh.material = materials[matKey];
                    mesh.isPickable = false; // The root will handle picking if needed, or we enable it globally
                }
            });

            // Set Up Hierarchy FIRST
            data.Parts.forEach(part => {
                const mesh = meshMap[part.Id];
                if (mesh) {
                    if (part.ParentId && meshMap[part.ParentId]) {
                        mesh.setParent(meshMap[part.ParentId]);
                    } else {
                        mesh.setParent(root);
                    }
                }
            });

            // Apply Positions and Rotations SECOND
            data.Parts.forEach(part => {
                const mesh = meshMap[part.Id];
                if (mesh) {
                    mesh.position = new BABYLON.Vector3(part.Position[0], part.Position[1], part.Position[2]);
                    mesh.rotation = new BABYLON.Vector3(
                        BABYLON.Tools.ToRadians(part.Rotation[0]),
                        BABYLON.Tools.ToRadians(part.Rotation[1]),
                        BABYLON.Tools.ToRadians(part.Rotation[2])
                    );
                }
            });

            return root;
        } catch (e) {
            console.error("Failed to load procedural model", modelName, e);
            // Fallback to a simple sphere
            const fallback = BABYLON.MeshBuilder.CreateSphere(modelName, {diameter: 0.7}, scene);
            fallback.position = new BABYLON.Vector3(position[0], position[1], position[2]);
            return fallback;
        }
    }
};
