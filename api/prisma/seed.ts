import { PrismaClient, Role, StorePlan, StoreStatus } from '@prisma/client'
import bcrypt from 'bcrypt'

const prisma = new PrismaClient()

// ─── Image paths (served from web/public/seeds/) ─────────────────
const img = {
  pizzaCalabresa: '/seeds/pizza-calabresa.webp',
  pizzaCalabresaCebola: '/seeds/pizza-calabresa-cebola.webp',
  pizzaCatupiry: '/seeds/pizza-catupiry.webp',
  pizzaMussarela: '/seeds/pizza-mussarela.webp',
  burgerEggBacon: '/seeds/burger-egg-bacon.webp',
  burgerSmashDuplo: '/seeds/burger-smash-duplo.webp',
  burgerGourmet: '/seeds/burger-gourmet.webp',
  burgerMega: '/seeds/burger-mega.webp',
  cocaCola: '/seeds/coca-cola-2l.webp',
  redbull: '/seeds/redbull-355ml.webp',
  agua: '/seeds/agua-500ml.webp',
}

async function seedProduction() {
  console.log('🌱 Production seed — owner only')

  const password = process.env.OWNER_INITIAL_PASSWORD
  if (!password || password.trim() === '') {
    console.log('⚠️  OWNER_INITIAL_PASSWORD não definida — nada a fazer.')
    return
  }

  const ownerEmail = 'wendellalonso2013@gmail.com'
  const existing = await prisma.user.findFirst({
    where: { email: ownerEmail, storeId: null },
  })

  if (existing) {
    console.log('✅ Owner já existe — nada a fazer:', existing.email)
    return
  }

  const owner = await prisma.user.create({
    data: {
      email: ownerEmail,
      name: 'Uendell',
      passwordHash: await bcrypt.hash(password, 12),
      role: Role.OWNER,
      isActive: true,
    },
  })
  console.log('✅ Owner criado:', owner.email)
}

async function main() {
  if (process.env.NODE_ENV === 'production') {
    await seedProduction()
    return
  }

  console.log('🌱 Starting seed...')

  // ─── Owner (Uendell) ────────────────────────────────────────────
  const owner =
    (await prisma.user.findFirst({ where: { email: 'uendell@menupanda.com', storeId: null } })) ??
    (await prisma.user.create({
      data: {
        email: 'uendell@menupanda.com',
        name: 'Uendell',
        passwordHash: await bcrypt.hash('owner123', 12),
        role: Role.OWNER,
        isActive: true,
      },
    }))
  console.log('✅ Owner created:', owner.email)

  // ─── Business Hours default ─────────────────────────────────────
  const defaultHours = [
    { openTime: '08:00', closeTime: '22:00', isClosed: false }, // Dom
    { openTime: '08:00', closeTime: '22:00', isClosed: false }, // Seg
    { openTime: '08:00', closeTime: '22:00', isClosed: false }, // Ter
    { openTime: '08:00', closeTime: '22:00', isClosed: false }, // Qua
    { openTime: '08:00', closeTime: '22:00', isClosed: false }, // Qui
    { openTime: '08:00', closeTime: '22:00', isClosed: false }, // Sex
    { openTime: '08:00', closeTime: '18:00', isClosed: false }, // Sáb
  ]

  async function seedBusinessHours(storeId: string) {
    for (let day = 0; day < 7; day++) {
      await prisma.businessHour.upsert({
        where: { storeId_dayOfWeek: { storeId, dayOfWeek: day } },
        update: {},
        create: { storeId, dayOfWeek: day, ...defaultHours[day] },
      })
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // LOJA A: Pizzaria Dona Maria (PROFESSIONAL)
  // ═══════════════════════════════════════════════════════════════════
  const lojaA = await prisma.store.upsert({
    where: { slug: 'pizzariadonamaria' },
    update: {
      allowPickup: true,
      allowCashOnDelivery: true,
      allowCreditCard: true,
      pixKey: 'maria@pizzariadonamaria.com',
      pixKeyType: 'EMAIL',
    },
    create: {
      name: 'Pizzaria Dona Maria',
      slug: 'pizzariadonamaria',
      customDomain: 'supercardapio.test',
      phone: '5511999990001',
      plan: StorePlan.PROFESSIONAL,
      status: StoreStatus.ACTIVE,
      allowPickup: true,
      allowCashOnDelivery: true,
      allowCreditCard: true,
      pixKey: 'maria@pizzariadonamaria.com',
      pixKeyType: 'EMAIL',
      features: {
        whatsapp_notifications: true,
        ai_assistant: false,
        delivery_area: false,
        analytics: true,
        coupons: false,
      },
    },
  })

  const adminLojaA = await prisma.user.upsert({
    where: { email_storeId: { email: 'admin@pizzariadonamaria.com', storeId: lojaA.id } },
    update: {},
    create: {
      email: 'admin@pizzariadonamaria.com',
      name: 'Maria',
      passwordHash: await bcrypt.hash('admin123', 12),
      role: Role.ADMIN,
      storeId: lojaA.id,
      isActive: true,
    },
  })

  await prisma.user.upsert({
    where: { whatsapp_storeId: { whatsapp: '5511999990011', storeId: lojaA.id } },
    update: {},
    create: {
      whatsapp: '5511999990011',
      name: 'Carlos (Motoboy Dona Maria)',
      role: Role.MOTOBOY,
      storeId: lojaA.id,
      isActive: true,
    },
  })

  await seedBusinessHours(lojaA.id)

  // Categorias Loja A
  const catPizzasSalgadasA = await prisma.category.create({
    data: { storeId: lojaA.id, name: 'Pizzas Salgadas', order: 1 },
  })
  const catPizzasDocesA = await prisma.category.create({
    data: { storeId: lojaA.id, name: 'Pizzas Doces', order: 2 },
  })
  const catBebidasA = await prisma.category.create({
    data: { storeId: lojaA.id, name: 'Bebidas', order: 3 },
  })

  // Produtos Loja A — Pizzas Salgadas
  await prisma.product.create({
    data: {
      storeId: lojaA.id,
      categoryId: catPizzasSalgadasA.id,
      name: 'Pizza Calabresa Especial',
      description: 'Massa artesanal com molho de tomate caseiro, calabresa defumada fatiada e mussarela derretida',
      imageUrl: img.pizzaCalabresa,
      basePrice: 45.90,
      order: 1,
      variations: {
        create: [
          { name: 'Brotinho (4 fatias)', price: 28.90 },
          { name: 'Média (8 fatias)', price: 45.90 },
          { name: 'Grande (12 fatias)', price: 59.90 },
        ],
      },
      additionals: {
        create: [
          { name: 'Borda recheada de catupiry', price: 8.00 },
          { name: 'Extra calabresa', price: 5.00 },
        ],
      },
    },
  })

  await prisma.product.create({
    data: {
      storeId: lojaA.id,
      categoryId: catPizzasSalgadasA.id,
      name: 'Pizza Calabresa com Cebola',
      description: 'Calabresa artesanal, cebola roxa em rodelas, azeitonas pretas e orégano fresco',
      imageUrl: img.pizzaCalabresaCebola,
      basePrice: 48.90,
      order: 2,
      variations: {
        create: [
          { name: 'Brotinho (4 fatias)', price: 29.90 },
          { name: 'Média (8 fatias)', price: 48.90 },
          { name: 'Grande (12 fatias)', price: 62.90 },
        ],
      },
    },
  })

  await prisma.product.create({
    data: {
      storeId: lojaA.id,
      categoryId: catPizzasSalgadasA.id,
      name: 'Pizza Catupiry com Pepperoni',
      description: 'Generosas camadas de pepperoni, catupiry cremoso em tiras cruzadas e molho italiano',
      imageUrl: img.pizzaCatupiry,
      basePrice: 52.90,
      order: 3,
      variations: {
        create: [
          { name: 'Brotinho (4 fatias)', price: 32.90 },
          { name: 'Média (8 fatias)', price: 52.90 },
          { name: 'Grande (12 fatias)', price: 67.90 },
        ],
      },
      additionals: {
        create: [
          { name: 'Extra catupiry', price: 6.00 },
        ],
      },
    },
  })

  await prisma.product.create({
    data: {
      storeId: lojaA.id,
      categoryId: catPizzasSalgadasA.id,
      name: 'Pizza Mussarela da Dona Maria',
      description: 'A clássica! Mussarela de primeira, tomate fatiado, orégano e azeite extra-virgem',
      imageUrl: img.pizzaMussarela,
      basePrice: 39.90,
      order: 4,
      variations: {
        create: [
          { name: 'Brotinho (4 fatias)', price: 24.90 },
          { name: 'Média (8 fatias)', price: 39.90 },
          { name: 'Grande (12 fatias)', price: 52.90 },
        ],
      },
    },
  })

  // Produtos Loja A — Pizzas Doces
  await prisma.product.create({
    data: {
      storeId: lojaA.id,
      categoryId: catPizzasDocesA.id,
      name: 'Pizza de Chocolate com Morango',
      description: 'Chocolate meio-amargo derretido com morangos frescos fatiados e leite condensado',
      basePrice: 42.90,
      order: 1,
    },
  })

  await prisma.product.create({
    data: {
      storeId: lojaA.id,
      categoryId: catPizzasDocesA.id,
      name: 'Pizza Romeu e Julieta',
      description: 'Goiabada cremosa com queijo minas derretido — o clássico mineiro em formato de pizza',
      basePrice: 38.90,
      order: 2,
    },
  })

  // Produtos Loja A — Bebidas
  await prisma.product.create({
    data: {
      storeId: lojaA.id,
      categoryId: catBebidasA.id,
      name: 'Coca-Cola 2L',
      description: 'Refrigerante Coca-Cola sabor original, garrafa PET 2 litros gelada',
      imageUrl: img.cocaCola,
      basePrice: 14.90,
      order: 1,
    },
  })

  await prisma.product.create({
    data: {
      storeId: lojaA.id,
      categoryId: catBebidasA.id,
      name: 'Água Mineral 500ml',
      description: 'Água mineral natural sem gás, garrafa PET 500ml',
      imageUrl: img.agua,
      basePrice: 4.90,
      order: 2,
    },
  })

  console.log('✅ Loja A criada:', lojaA.slug, '| Admin:', adminLojaA.email, '| 8 produtos, 3 categorias')

  // ═══════════════════════════════════════════════════════════════════
  // LOJA B: Burguer Top (PREMIUM)
  // ═══════════════════════════════════════════════════════════════════
  const lojaB = await prisma.store.upsert({
    where: { slug: 'burguertop' },
    update: {},
    create: {
      name: 'Burguer Top',
      slug: 'burguertop',
      phone: '5511999990002',
      plan: StorePlan.PREMIUM,
      status: StoreStatus.ACTIVE,
      features: {
        whatsapp_notifications: true,
        ai_assistant: true,
        delivery_area: true,
        analytics: true,
        coupons: true,
      },
    },
  })

  const adminLojaB = await prisma.user.upsert({
    where: { email_storeId: { email: 'admin@burguertop.com', storeId: lojaB.id } },
    update: {},
    create: {
      email: 'admin@burguertop.com',
      name: 'João',
      passwordHash: await bcrypt.hash('admin123', 12),
      role: Role.ADMIN,
      storeId: lojaB.id,
      isActive: true,
    },
  })

  await prisma.user.upsert({
    where: { whatsapp_storeId: { whatsapp: '5511999990022', storeId: lojaB.id } },
    update: {},
    create: {
      whatsapp: '5511999990022',
      name: 'Pedro (Motoboy Burguer Top)',
      role: Role.MOTOBOY,
      storeId: lojaB.id,
      isActive: true,
    },
  })

  await seedBusinessHours(lojaB.id)

  // Categorias Loja B
  const catBurguersB = await prisma.category.create({
    data: { storeId: lojaB.id, name: 'Hambúrgueres', order: 1 },
  })
  const catAcompB = await prisma.category.create({
    data: { storeId: lojaB.id, name: 'Acompanhamentos', order: 2 },
  })
  const catBebidasB = await prisma.category.create({
    data: { storeId: lojaB.id, name: 'Bebidas', order: 3 },
  })

  // Produtos Loja B — Hambúrgueres
  await prisma.product.create({
    data: {
      storeId: lojaB.id,
      categoryId: catBurguersB.id,
      name: 'X-Egg Bacon Artesanal',
      description: 'Pão brioche tostado, burger 200g na brasa, ovo caipira, bacon crocante, cheddar e alface americana',
      imageUrl: img.burgerEggBacon,
      basePrice: 34.90,
      order: 1,
      additionals: {
        create: [
          { name: 'Extra bacon', price: 5.00 },
          { name: 'Extra cheddar', price: 4.00 },
          { name: 'Ovo extra', price: 3.00 },
        ],
      },
    },
  })

  await prisma.product.create({
    data: {
      storeId: lojaB.id,
      categoryId: catBurguersB.id,
      name: 'Smash Duplo Cheddar',
      description: 'Dois smash burgers 100g prensados na chapa, cheddar derretido, bacon e molho da casa no pão com gergelim',
      imageUrl: img.burgerSmashDuplo,
      basePrice: 38.90,
      order: 2,
      additionals: {
        create: [
          { name: 'Terceiro smash', price: 8.00 },
          { name: 'Onion rings (6un)', price: 7.00 },
        ],
      },
    },
  })

  await prisma.product.create({
    data: {
      storeId: lojaB.id,
      categoryId: catBurguersB.id,
      name: 'Burguer Gourmet Premium',
      description: 'Pão australiano, burger angus 180g, bacon crispy, queijo brie, cebola caramelizada, rúcula e maionese trufada. Acompanha batata crinkle',
      imageUrl: img.burgerGourmet,
      basePrice: 46.90,
      order: 3,
    },
  })

  await prisma.product.create({
    data: {
      storeId: lojaB.id,
      categoryId: catBurguersB.id,
      name: 'X-Mega Tudo',
      description: 'O monstro da casa! Dois burgers 180g, bacon duplo, cheddar, ovo, presunto, alface, tomate e molho especial',
      imageUrl: img.burgerMega,
      basePrice: 49.90,
      order: 4,
      variations: {
        create: [
          { name: 'Normal', price: 49.90 },
          { name: 'Combo (+ batata + refri)', price: 62.90 },
        ],
      },
    },
  })

  await prisma.product.create({
    data: {
      storeId: lojaB.id,
      categoryId: catBurguersB.id,
      name: 'X-Salada Fit',
      description: 'Burger de frango grelhado 150g, queijo branco, alface, tomate, pepino e molho de iogurte no pão integral',
      basePrice: 28.90,
      order: 5,
    },
  })

  // Produtos Loja B — Acompanhamentos
  await prisma.product.create({
    data: {
      storeId: lojaB.id,
      categoryId: catAcompB.id,
      name: 'Batata Frita Cheddar & Bacon',
      description: 'Porção de batata frita crocante coberta com cheddar cremoso e bacon picado',
      basePrice: 24.90,
      order: 1,
      variations: {
        create: [
          { name: 'Individual', price: 18.90 },
          { name: 'Para compartilhar', price: 24.90 },
        ],
      },
    },
  })

  await prisma.product.create({
    data: {
      storeId: lojaB.id,
      categoryId: catAcompB.id,
      name: 'Onion Rings (12un)',
      description: 'Anéis de cebola empanados crocantes com molho barbecue',
      basePrice: 19.90,
      order: 2,
    },
  })

  // Produtos Loja B — Bebidas
  await prisma.product.create({
    data: {
      storeId: lojaB.id,
      categoryId: catBebidasB.id,
      name: 'Red Bull Energy 355ml',
      description: 'Energético Red Bull lata 355ml — vitaliza corpo e mente',
      imageUrl: img.redbull,
      basePrice: 15.90,
      order: 1,
    },
  })

  await prisma.product.create({
    data: {
      storeId: lojaB.id,
      categoryId: catBebidasB.id,
      name: 'Coca-Cola 2 Litros',
      description: 'Refrigerante Coca-Cola original 2L para acompanhar seu lanche',
      imageUrl: img.cocaCola,
      basePrice: 13.90,
      order: 2,
    },
  })

  await prisma.product.create({
    data: {
      storeId: lojaB.id,
      categoryId: catBebidasB.id,
      name: 'Água Mineral sem Gás',
      description: 'Água mineral natural, garrafa 500ml gelada',
      imageUrl: img.agua,
      basePrice: 4.50,
      order: 3,
    },
  })

  console.log('✅ Loja B criada:', lojaB.slug, '| Admin:', adminLojaB.email, '| 10 produtos, 3 categorias')

  // ═══════════════════════════════════════════════════════════════════
  // LOJA C: Sushi Express (PROFESSIONAL, SUSPENDED)
  // ═══════════════════════════════════════════════════════════════════
  const lojaC = await prisma.store.upsert({
    where: { slug: 'sushiexpress' },
    update: {},
    create: {
      name: 'Sushi Express',
      slug: 'sushiexpress',
      phone: '5511999990003',
      plan: StorePlan.PROFESSIONAL,
      status: StoreStatus.SUSPENDED,
      features: {
        whatsapp_notifications: true,
        ai_assistant: false,
        delivery_area: false,
        analytics: true,
        coupons: false,
      },
    },
  })

  const adminLojaC = await prisma.user.upsert({
    where: { email_storeId: { email: 'admin@sushiexpress.com', storeId: lojaC.id } },
    update: {},
    create: {
      email: 'admin@sushiexpress.com',
      name: 'Ana',
      passwordHash: await bcrypt.hash('admin123', 12),
      role: Role.ADMIN,
      storeId: lojaC.id,
      isActive: true,
    },
  })

  await prisma.user.upsert({
    where: { whatsapp_storeId: { whatsapp: '5511999990033', storeId: lojaC.id } },
    update: {},
    create: {
      whatsapp: '5511999990033',
      name: 'Lucas (Motoboy Sushi Express)',
      role: Role.MOTOBOY,
      storeId: lojaC.id,
      isActive: true,
    },
  })

  await seedBusinessHours(lojaC.id)

  // Categorias Loja C
  const catCombinadosC = await prisma.category.create({
    data: { storeId: lojaC.id, name: 'Combinados', order: 1 },
  })
  const catTemakisC = await prisma.category.create({
    data: { storeId: lojaC.id, name: 'Temakis', order: 2 },
  })
  const catHotRollC = await prisma.category.create({
    data: { storeId: lojaC.id, name: 'Hot Rolls', order: 3 },
  })
  const catBebidasC = await prisma.category.create({
    data: { storeId: lojaC.id, name: 'Bebidas', order: 4 },
  })

  // Produtos Loja C — Combinados
  await prisma.product.create({
    data: {
      storeId: lojaC.id,
      categoryId: catCombinadosC.id,
      name: 'Combo Salmão Premium (30 peças)',
      description: '10 niguiri salmão, 8 uramaki filadélfia, 6 hossomaki salmão, 6 jyo salmão grelhado',
      basePrice: 89.90,
      order: 1,
      variations: {
        create: [
          { name: '20 peças', price: 64.90 },
          { name: '30 peças', price: 89.90 },
          { name: '50 peças', price: 139.90 },
        ],
      },
      additionals: {
        create: [
          { name: 'Molho tarê extra', price: 3.00 },
          { name: 'Gengibre extra', price: 2.00 },
          { name: 'Wasabi extra', price: 2.00 },
        ],
      },
    },
  })

  await prisma.product.create({
    data: {
      storeId: lojaC.id,
      categoryId: catCombinadosC.id,
      name: 'Combo Misto Oriental (24 peças)',
      description: '6 niguiri variados, 8 uramaki califórnia, 4 hossomaki kani, 6 hot roll',
      basePrice: 69.90,
      order: 2,
    },
  })

  await prisma.product.create({
    data: {
      storeId: lojaC.id,
      categoryId: catCombinadosC.id,
      name: 'Combo Hot (20 peças)',
      description: '10 hot filadélfia, 5 hot salmão, 5 hot kani — todos empanados e fritos na hora',
      basePrice: 54.90,
      order: 3,
    },
  })

  // Produtos Loja C — Temakis
  await prisma.product.create({
    data: {
      storeId: lojaC.id,
      categoryId: catTemakisC.id,
      name: 'Temaki Salmão Cremoso',
      description: 'Cone de nori recheado com salmão fresco, cream cheese Philadelphia e cebolinha',
      basePrice: 26.90,
      order: 1,
    },
  })

  await prisma.product.create({
    data: {
      storeId: lojaC.id,
      categoryId: catTemakisC.id,
      name: 'Temaki Camarão Empanado',
      description: 'Camarão empanado crocante com cream cheese, manga e molho tarê',
      basePrice: 29.90,
      order: 2,
    },
  })

  await prisma.product.create({
    data: {
      storeId: lojaC.id,
      categoryId: catTemakisC.id,
      name: 'Temaki Skin',
      description: 'Pele de salmão grelhada crocante com cream cheese e cebolinha — nosso best seller',
      basePrice: 22.90,
      order: 3,
    },
  })

  // Produtos Loja C — Hot Rolls
  await prisma.product.create({
    data: {
      storeId: lojaC.id,
      categoryId: catHotRollC.id,
      name: 'Hot Roll Filadélfia (10 un)',
      description: 'Uramaki empanado recheado com salmão e cream cheese, coberto com molho tarê e gergelim',
      basePrice: 32.90,
      order: 1,
    },
  })

  await prisma.product.create({
    data: {
      storeId: lojaC.id,
      categoryId: catHotRollC.id,
      name: 'Hot Roll Nutella (8 un)',
      description: 'Rolinhos empanados recheados com Nutella e banana, finalizados com leite condensado',
      basePrice: 28.90,
      order: 2,
    },
  })

  // Produtos Loja C — Bebidas
  await prisma.product.create({
    data: {
      storeId: lojaC.id,
      categoryId: catBebidasC.id,
      name: 'Água Mineral Gelada 500ml',
      description: 'Água mineral natural sem gás, 500ml',
      imageUrl: img.agua,
      basePrice: 5.00,
      order: 1,
    },
  })

  await prisma.product.create({
    data: {
      storeId: lojaC.id,
      categoryId: catBebidasC.id,
      name: 'Refrigerante Coca-Cola 2L',
      description: 'Coca-Cola Original garrafa 2 litros',
      imageUrl: img.cocaCola,
      basePrice: 14.00,
      order: 2,
    },
  })

  console.log('✅ Loja C criada:', lojaC.slug, '| Admin:', adminLojaC.email, '| 10 produtos, 4 categorias')

  console.log('\n🎉 Seed concluído!')
  console.log('\n📋 Credenciais de acesso:')
  console.log('  Owner:           uendell@menupanda.com / owner123')
  console.log('  Admin Loja A:    admin@pizzariadonamaria.com / admin123')
  console.log('  Admin Loja B:    admin@burguertop.com / admin123')
  console.log('  Admin Loja C:    admin@sushiexpress.com / admin123')
  console.log('\n🌐 URLs de teste (após /etc/hosts + mkcert):')
  console.log('  https://pizzariadonamaria.cardapio.test:5173')
  console.log('  https://burguertop.cardapio.test:5173')
  console.log('  https://sushiexpress.cardapio.test:5173')
  console.log('  https://supercardapio.test:5173  (customDomain → Pizzaria Dona Maria)')
  console.log('\n🖼️  Imagens locais: web/public/seeds/ (11 arquivos .webp)')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
