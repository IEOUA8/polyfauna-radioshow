-- show_questions: preguntas de oyentes al host durante transmisiones en vivo
CREATE TABLE IF NOT EXISTS public.show_questions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_name   TEXT,
  show_name   TEXT,
  question    TEXT NOT NULL,
  answered    BOOLEAN DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.show_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_insert_own_questions" ON public.show_questions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_read_own_questions" ON public.show_questions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "admins_manage_questions" ON public.show_questions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );
