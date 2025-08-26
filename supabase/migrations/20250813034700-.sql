-- Fix remaining database functions missing search_path

CREATE OR REPLACE FUNCTION public.calculate_level(exp integer)
 RETURNS integer
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path = ''
AS $function$
DECLARE
  current_level INTEGER := 1;
  required_exp INTEGER := 0;
  level_increment INTEGER := 50;
BEGIN
  -- Level 1 = 0 exp, Level 2 = 50 exp, Level 3 = 125 exp (50+75), Level 4 = 225 exp (50+75+100), etc.
  WHILE exp >= required_exp LOOP
    IF current_level = 1 THEN
      required_exp := required_exp + level_increment; -- Level 2 requires 50 exp
    ELSE
      required_exp := required_exp + (level_increment + (current_level - 2) * 25); -- Each level adds 25 more exp requirement
    END IF;
    
    IF exp >= required_exp THEN
      current_level := current_level + 1;
    END IF;
  END LOOP;
  
  RETURN current_level;
END;
$function$;

CREATE OR REPLACE FUNCTION public.exp_for_next_level(current_exp integer)
 RETURNS integer
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path = ''
AS $function$
DECLARE
  current_level INTEGER;
  required_exp INTEGER := 0;
  level_increment INTEGER := 50;
  i INTEGER := 1;
BEGIN
  current_level := public.calculate_level(current_exp);
  
  -- Calculate total exp needed for next level
  WHILE i <= current_level LOOP
    IF i = 1 THEN
      -- Level 1 to 2 requires 50 exp
      required_exp := required_exp + level_increment;
    ELSE
      -- Each subsequent level requires 25 more exp than the previous increment
      required_exp := required_exp + (level_increment + (i - 2) * 25);
    END IF;
    i := i + 1;
  END LOOP;
  
  RETURN required_exp;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_user_level()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path = ''
AS $function$
BEGIN
  NEW.level := public.calculate_level(NEW.experience);
  RETURN NEW;
END;
$function$;