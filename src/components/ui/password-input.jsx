import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

const PasswordInput = React.forwardRef(({ className, rightSlot, ...props }, ref) => {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <Input type={visible ? 'text' : 'password'} className={cn(rightSlot ? 'pr-16' : 'pr-11', className)} ref={ref} {...props} />
      <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
        {rightSlot}
        <button
          type="button"
          onClick={() => setVisible(v => !v)}
          tabIndex={-1}
          aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          className="text-white/30 hover:text-white/70 transition-colors"
        >
          {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
});
PasswordInput.displayName = 'PasswordInput';

export { PasswordInput };
