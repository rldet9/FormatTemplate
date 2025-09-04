import * as fs from 'fs';
import * as path from 'path';
import { ITransformHandler } from './interfaces/TransformHandler';
import { TransformHandlerRegistry } from './TransformHandlerRegistry';

/**
 * Découvre et enregistre automatiquement les handlers de transformation
 */
export class AutoDiscovery {
  /**
   * Charge tous les handlers du dossier spécifié
   */
  static loadHandlersFromDirectory(dirPath: string = path.join(__dirname, 'handlers')): void {
    if (!fs.existsSync(dirPath)) {
      console.warn(`[FormatTemplate] Directory not found: ${dirPath}`);
      return;
    }

    // Lire tous les fichiers du dossier
    const files = fs.readdirSync(dirPath);

    // Filtrer pour ne garder que les fichiers TypeScript/JavaScript
    const handlerFiles = files.filter(file =>
      /\.((j|t)s)$/.test(file) && !file.endsWith('.d.ts')
    );

    // Charger chaque fichier et enregistrer les handlers qu'il exporte
    for (const file of handlerFiles) {
      try {
        const filePath = path.join(dirPath, file);

        const module = require(filePath);

        // Explorer toutes les exportations du module
        for (const key of Object.keys(module)) {
          const potentialHandler = module[key];

          // Vérifier si c'est une classe qui peut être instanciée
          if (typeof potentialHandler === 'function') {
            try {
              const instance = new potentialHandler();

              // Vérifier si l'instance semble être un TransformHandler
              if (this.isTransformHandler(instance)) {
                TransformHandlerRegistry.register(instance);
                console.log(`[FormatTemplate] Registered handler: ${instance.type}`);
              }
            } catch (err) {
              console.error(`[FormatTemplate] Error instantiating handler from ${file}:`, err);
            }
          }
        }
      } catch (err) {
        console.error(`[FormatTemplate] Error loading handler file ${file}:`, err);
      }
    }
  }

  /**
   * Vérifie si un objet implémente l'interface ITransformHandler
   */
  private static isTransformHandler(obj: any): obj is ITransformHandler {
    return (
      obj &&
      typeof obj.type === 'string' &&
      typeof obj.displayName === 'string' &&
      typeof obj.description === 'string' &&
      Array.isArray(obj.properties) &&
      typeof obj.transform === 'function'
    );
  }
}
