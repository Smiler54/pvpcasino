import type { Config } from "tailwindcss";

export default {
	darkMode: ["class"],
	content: [
		"./pages/**/*.{ts,tsx}",
		"./components/**/*.{ts,tsx}",
		"./app/**/*.{ts,tsx}",
		"./src/**/*.{ts,tsx}",
	],
	prefix: "",
	theme: {
		container: {
			center: true,
			padding: '2rem',
			screens: {
				'2xl': '1400px'
			}
		},
		extend: {
			colors: {
				border: 'hsl(var(--border))',
				input: 'hsl(var(--input))',
				ring: 'hsl(var(--ring))',
				background: 'hsl(var(--background))',
				foreground: 'hsl(var(--foreground))',
				primary: {
					DEFAULT: 'hsl(var(--primary))',
					foreground: 'hsl(var(--primary-foreground))'
				},
				secondary: {
					DEFAULT: 'hsl(var(--secondary))',
					foreground: 'hsl(var(--secondary-foreground))'
				},
				destructive: {
					DEFAULT: 'hsl(var(--destructive))',
					foreground: 'hsl(var(--destructive-foreground))'
				},
				muted: {
					DEFAULT: 'hsl(var(--muted))',
					foreground: 'hsl(var(--muted-foreground))'
				},
				accent: {
					DEFAULT: 'hsl(var(--accent))',
					foreground: 'hsl(var(--accent-foreground))'
				},
				popover: {
					DEFAULT: 'hsl(var(--popover))',
					foreground: 'hsl(var(--popover-foreground))'
				},
				card: {
					DEFAULT: 'hsl(var(--card))',
					foreground: 'hsl(var(--card-foreground))'
				},
				crypto: {
					green: 'hsl(var(--crypto-green))',
					red: 'hsl(var(--crypto-red))',
					gold: 'hsl(var(--crypto-gold))',
					blue: 'hsl(var(--crypto-blue))'
				}
			},
			backgroundImage: {
				'gradient-primary': 'var(--gradient-primary)',
				'gradient-gold': 'var(--gradient-gold)',
				'gradient-danger': 'var(--gradient-danger)'
			},
			boxShadow: {
				'glow': 'var(--shadow-glow)',
				'gold-glow': 'var(--shadow-gold-glow)',
				'danger-glow': 'var(--shadow-danger-glow)'
			},
			transitionTimingFunction: {
				'smooth': 'var(--transition-smooth)'
			},
			borderRadius: {
				lg: 'var(--radius)',
				md: 'calc(var(--radius) - 2px)',
				sm: 'calc(var(--radius) - 4px)'
			},
			keyframes: {
				'accordion-down': {
					from: {
						height: '0'
					},
					to: {
						height: 'var(--radix-accordion-content-height)'
					}
				},
				'accordion-up': {
					from: {
						height: 'var(--radix-accordion-content-height)'
					},
					to: {
						height: '0'
					}
				},
				'spin-slow': {
					from: { transform: 'rotate(0deg)' },
					to: { transform: 'rotate(360deg)' }
				},
				'confetti': {
					'0%': { 
						transform: 'translate3d(0, -20px, 0) rotate(0deg)',
						opacity: '1'
					},
					'100%': { 
						transform: 'translate3d(0, 100vh, 0) rotate(720deg)',
						opacity: '0'
					}
				},
				'fade-in': {
					from: { opacity: '0', transform: 'translateY(10px)' },
					to: { opacity: '1', transform: 'translateY(0)' }
				},
				'scale-in': {
					from: { transform: 'scale(0.9)', opacity: '0' },
					to: { transform: 'scale(1)', opacity: '1' }
				},
				'glow-pulse': {
					'0%, 100%': { 
						boxShadow: '0 0 20px hsl(var(--crypto-gold))',
						transform: 'scale(1)'
					},
					'50%': { 
						boxShadow: '0 0 40px hsl(var(--crypto-gold)), 0 0 60px hsl(var(--crypto-gold))',
						transform: 'scale(1.05)'
					}
				},
				'rgb-cycle-optimized': {
					'0%': { 
						transform: 'translate3d(0, 0, 0) rotate(0deg)',
						filter: 'hue-rotate(0deg) brightness(1.1)'
					},
					'25%': { 
						transform: 'translate3d(0, 0, 0) rotate(90deg)',
						filter: 'hue-rotate(90deg) brightness(1.2)'
					},
					'50%': { 
						transform: 'translate3d(0, 0, 0) rotate(180deg)',
						filter: 'hue-rotate(180deg) brightness(1.1)'
					},
					'75%': { 
						transform: 'translate3d(0, 0, 0) rotate(270deg)',
						filter: 'hue-rotate(270deg) brightness(1.2)'
					},
					'100%': { 
						transform: 'translate3d(0, 0, 0) rotate(360deg)',
						filter: 'hue-rotate(360deg) brightness(1.1)'
					}
				}
			},
			animation: {
				'accordion-down': 'accordion-down 0.2s ease-out',
				'accordion-up': 'accordion-up 0.2s ease-out',
				'spin-slow': 'spin-slow 2s linear infinite',
				'confetti': 'confetti 2s linear infinite',
				'fade-in': 'fade-in 0.3s ease-out',
				'scale-in': 'scale-in 0.2s ease-out',
				'glow-pulse': 'glow-pulse 2s ease-in-out infinite',
				'rgb-cycle-optimized': 'rgb-cycle-optimized 3s linear infinite'
			}
		}
	},
	plugins: [require("tailwindcss-animate")],
} satisfies Config;
