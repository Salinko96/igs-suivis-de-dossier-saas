-- ==============================================================================
-- MIGRATION : Machine à États des Statuts Douaniers & Surveillance Surestaries PAC
-- Date : 2026-08-20
-- Auteur : Senior Full-Stack Engineer / IGS Platform
-- ==============================================================================

-- 1. FONCTION DE VÉRIFICATION DE TRANSITION D'ÉTAT STRICTE
CREATE OR REPLACE FUNCTION check_dossier_status_integrity()
RETURNS TRIGGER AS $$
BEGIN
  -- Règle absolue du Code des Douanes : Un dossier ne peut être "Régularisé"
  -- que si la marchandise est effectivement sortie du quai ET que la déclaration douanière existe.
  IF NEW.calculated_status = 'Régularisé' THEN
    IF NEW.goods_release_date IS NULL THEN
      RAISE EXCEPTION 'Transition vers Régularisé interdite : la date de sortie marchandise (goods_release_date) est obligatoire.';
    END IF;

    IF NEW.declaration_number IS NULL OR LENGTH(TRIM(NEW.declaration_number)) = 0 THEN
      RAISE EXCEPTION 'Transition vers Régularisé interdite : le numéro de déclaration en douane (declaration_number) est obligatoire.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. TRIGGER AUTOMATIQUE SUR LA TABLE DOSSIERS
DROP TRIGGER IF EXISTS trg_check_dossier_status_integrity ON dossiers;

CREATE TRIGGER trg_check_dossier_status_integrity
BEFORE INSERT OR UPDATE ON dossiers
FOR EACH ROW
EXECUTE FUNCTION check_dossier_status_integrity();

-- 3. INDEX OPTIMISÉS POUR LES REQUÊTES SURESTARIES & TERRAIN QUAI
CREATE INDEX IF NOT EXISTS idx_dossiers_eta_release_risk 
ON dossiers (eta, goods_release_date) 
WHERE goods_release_date IS NULL;

CREATE INDEX IF NOT EXISTS idx_dossiers_declarant_status 
ON dossiers (declarant, calculated_status);
