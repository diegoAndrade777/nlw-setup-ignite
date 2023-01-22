import { FastifyInstance } from 'fastify'
import { prisma } from './lib/prisma'
import { z } from 'zod'
import dayjs from 'dayjs'
import { User } from '@prisma/client'

export async function appRoutes(server: FastifyInstance) {
  server.post('/signup', async (request) => {
    const createHabitBody = z.object({
      username: z.string().min(3).max(30),
      password: z.string().min(6).max(30)
    })

    const { username, password } = createHabitBody.parse(request.body)

    const userExists = await prisma.user.findFirst({
      where: {
        username
      }
    })

    if (userExists) {
      throw new Error('this user already exists')
    }

    const { id } = await prisma.user.create({
      data: {
        username,
        hash: await server.bcrypt.hash(password)
      }
    })

    // some code
    const token = server.jwt.sign({ id, username })

    return {
      token
    }
  })

  server.post('/signin', async (request) => {
    const createHabitBody = z.object({
      username: z.string().min(3).max(30),
      password: z.string().min(6).max(30)
    })

    const { username, password } = createHabitBody.parse(request.body)

    const userExists = await prisma.user.findFirst({
      where: {
        username
      }
    })

    if (!userExists) {
      throw new Error('User not found')
    }

    const isValid = await server.bcrypt.compare(password, userExists.hash)

    if (!isValid) {
      throw new Error('Invalid credentials')
    }

    // some code
    const token = server.jwt.sign({ id: userExists.id, username })

    return {
      token
    }
  })

  server.get('/me', (request) => request.user)

  server.post('/habits', async (request) => {
    const createHabitBody = z.object({
      title: z.string(),
      weekDays: z.array(z.number().min(0).max(6))
    })

    const { title, weekDays } = createHabitBody.parse(request.body)

    const today = dayjs().startOf('day').toDate()

    await prisma.habit.create({
      data: {
        title,
        weekDays: {
          create: weekDays.map((day) => ({
            week_day: day
          }))
        },
        created_at: today
      }
    })
  })

  server.get('/day', async (request) => {
    const getDayParams = z.object({
      date: z.coerce.date()
    })

    const { date } = getDayParams.parse(request.query)

    const parsedDate = dayjs(date).startOf('day')
    const weekDay = dayjs(parsedDate).get('day')

    const possibleHabits = await prisma.habit.findMany({
      where: {
        created_at: {
          lte: date
        },
        weekDays: {
          some: {
            week_day: weekDay
          }
        }
      }
    })

    const day = await prisma.day.findUnique({
      where: {
        date: parsedDate.toDate()
      },
      include: {
        dayHabits: true
      }
    })

    const completedHabits = day?.dayHabits.map((dayHabit) => dayHabit.habit_id)

    return { possibleHabits, completedHabits }
  })

  server.patch('/habits/:id/toggle', async (request) => {
    const toggleHabitParams = z.object({
      id: z.string().uuid()
    })

    const { id } = toggleHabitParams.parse(request.params)

    const today = dayjs().startOf('day').toDate()

    let day = await prisma.day.findUnique({
      where: {
        date: today
      }
    })

    if (!day) {
      day = await prisma.day.create({
        data: {
          date: today
        }
      })
    }

    const dayHabit = await prisma.dayHabit.findUnique({
      where: {
        day_id_habit_id: {
          day_id: day.id,
          habit_id: id
        }
      }
    })

    if (dayHabit) {
      await prisma.dayHabit.delete({
        where: {
          id: dayHabit.id
        }
      })
    } else {
      await prisma.dayHabit.create({
        data: {
          day_id: day.id,
          habit_id: id
        }
      })
    }
  })

  server.get('/summary', async (request) => {
    const summary = await prisma.$queryRaw`
      SELECT
        day.id,
        day.date,
        (
          SELECT cast(count(*) as float)
            FROM day_habits dayhabit
           WHERE dayhabit.day_id = day.id 
        ) as completed,
        (
          SELECT cast(count(*) as float)
            FROM habit_week_days hwd
            JOIN habits h
              ON h.id = hwd.habit_id
           WHERE hwd.week_day = cast(strftime('%w', day.date / 1000, 'unixepoch') as int)
             AND h.created_at <= day.date
        ) as amount
      FROM
        days day
    `

    return summary
  })

  server.get('*', () => {
    return 'Make your habits to reality'
  })
}
