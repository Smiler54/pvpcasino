-- Create enum for user roles
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

-- Create user_roles table
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    role app_role NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- RLS policies for user_roles
CREATE POLICY "Users can view their own roles" 
ON public.user_roles 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all roles" 
ON public.user_roles 
FOR ALL 
USING (public.has_role(auth.uid(), 'admin'));

-- Function to create admin user with unlimited credits
CREATE OR REPLACE FUNCTION public.create_admin_user(
  p_email TEXT,
  p_password TEXT,
  p_username TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_result JSON;
BEGIN
  -- Create the user in auth.users (this simulates signup)
  -- Note: In a real scenario, you'd use Supabase Auth API
  -- For now, we'll create a profile and role entry that can be linked later
  
  -- Insert into profiles with a very high balance (effectively unlimited)
  INSERT INTO public.profiles (user_id, username, balance)
  VALUES (gen_random_uuid(), p_username, 999999999.99)
  RETURNING user_id INTO v_user_id;
  
  -- Assign admin role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_user_id, 'admin');
  
  -- Return the created user info
  SELECT json_build_object(
    'success', true,
    'user_id', v_user_id,
    'username', p_username,
    'balance', 999999999.99,
    'role', 'admin',
    'message', 'Admin user created. You''ll need to manually create the auth account in Supabase Auth with email: ' || p_email || ' and link it to user_id: ' || v_user_id
  ) INTO v_result;
  
  RETURN v_result;
END;
$$;

-- Create the admin user
SELECT public.create_admin_user(
  'admin@pvpcasino.com',
  'Admin123',
  'Admin 1'
);